import { getSheetCached, appendRow, updateRow, getSheetData } from '../../lib/googleSheets';
import { buildColumnResolver, normalizeHeader } from '../../lib/sheets/headerResolver';
import { normalizePhones } from '../../lib/report';

// ✅ Protege números de telefone para salvar como texto no Sheets
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}

// ✅ Junta os 3 tipos de e-mail e remove duplicados
function collectEmails(row, idx) {
  const emails = [
    row[idx.emailWork] || '',
    row[idx.emailHome] || '',
    row[idx.emailOther] || '',
  ].map(e => e.trim()).filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

async function groupRows(rows) {
  const [header, ...data] = rows;
  const requiredColumns = ['cliente_id', 'segmento', 'organizacao_nome', 'negocio_titulo', 'negocio_pessoa_de_contato', 'pessoa_cargo', 'pessoa_email_work', 'pessoa_email_home', 'pessoa_email_other', 'pessoa_phone_work', 'pessoa_phone_home', 'pessoa_phone_mobile', 'pessoa_phone_other', 'pessoa_telefone', 'pessoa_celular', 'telefone_normalizado', 'organizacao_tamanho_da_empresa', 'uf', 'cidade_estimada', 'status_kanban', 'data_ultima_movimentacao', 'pessoa_end_linkedin', 'cor_card'];

  const headersNorm = header.map(h => normalizeHeader(h)).filter(Boolean);
  const missing = requiredColumns.filter(r => !headersNorm.includes(r));

  if (missing.length) {
    console.warn('[api/clientes] Missing required columns:', missing);
    // Retorna 200 com array vazio para não quebrar o front
    return { clients: [], filters: { segmento: [], porte: [], uf: [], cidade: [] } };
  }

  const SHEET = 'Sheet1';
  const COL = await buildColumnResolver(SHEET);
  const idx = {
    clienteId: header.indexOf(COL('cliente_id')),
    org: header.indexOf(COL('organizacao_nome')),
    titulo: header.indexOf(COL('negocio_titulo')),
    contato: header.indexOf(COL('negocio_pessoa_de_contato')),
    cargo: header.indexOf(COL('pessoa_cargo')),
    emailWork: header.indexOf(COL('pessoa_email_work')),
    emailHome: header.indexOf(COL('pessoa_email_home')),
    emailOther: header.indexOf(COL('pessoa_email_other')),
    phoneWork: header.indexOf(COL('pessoa_phone_work')),
    phoneHome: header.indexOf(COL('pessoa_phone_home')),
    phoneMobile: header.indexOf(COL('pessoa_phone_mobile')),
    phoneOther: header.indexOf(COL('pessoa_phone_other')),
    tel: header.indexOf(COL('pessoa_telefone')),
    cel: header.indexOf(COL('pessoa_celular')),
    normalizado: header.indexOf(COL('telefone_normalizado')),
    segmento: header.indexOf(COL('segmento')),
    tamanho: header.indexOf(COL('organizacao_tamanho_da_empresa')),
    uf: header.indexOf(COL('uf')),
    cidade: header.indexOf(COL('cidade_estimada')),
    status: header.indexOf(COL('status_kanban')),
    data: header.indexOf(COL('data_ultima_movimentacao')),
    linkedin: header.indexOf(COL('pessoa_end_linkedin')),
    cor: header.indexOf(COL('cor_card')),
  };

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const clientesMap = new Map();

  data.forEach((row) => {
    const clienteId = row[idx.clienteId] || '';
    const company = row[idx.org] || '';
    const segment = row[idx.segmento] || '';
    const size = row[idx.tamanho] || '';
    const uf = row[idx.uf] || '';
    const city = row[idx.cidade] || '';
    const status = row[idx.status] || '';
    const dataMov = row[idx.data] || '';
    const color = row[idx.cor] || '';

    filters.segmento.add(segment);
    filters.porte.add(size);
    filters.uf.add(uf);
    filters.cidade.add(city);

    const contact = {
      name: (row[idx.contato] || '').trim(),
      role: (row[idx.cargo] || '').trim(),
      email: collectEmails(row, idx),
      phone: protectPhoneValue(row[idx.tel]),
      mobile: protectPhoneValue(row[idx.cel]),
      normalizedPhones: normalizePhones(row, idx).map(protectPhoneValue),
      linkedin: (row[idx.linkedin] || '').trim(),
    };

    const opportunity = row[idx.titulo] || '';

    if (clientesMap.has(clienteId)) {
      const existing = clientesMap.get(clienteId);

      if (opportunity && !existing.opportunities.includes(opportunity)) {
        existing.opportunities.push(opportunity);
      }

      const existsContact = existing.contacts.find(
        (c) => c.name === contact.name && c.email === contact.email
      );
      if (!existsContact && (contact.name || contact.email)) {
        existing.contacts.push(contact);
      }
    } else {
      clientesMap.set(clienteId, {
        id: clienteId,
        company,
        opportunities: opportunity ? [opportunity] : [],
        contacts: contact.name || contact.email ? [contact] : [],
        segment,
        size,
        uf,
        city,
        status,
        dataMov,
        color,
      });
    }
  });

  const clients = Array.from(clientesMap.values());

  return {
    clients,
    filters: {
      segmento: Array.from(filters.segmento).sort(),
      porte: Array.from(filters.porte).sort(),
      uf: Array.from(filters.uf).sort(),
      cidade: Array.from(filters.cidade).sort(),
    },
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { headers, rows: dataRows } = await getSheetData('Sheet1');
      // const rows = sheet.data.values || []; // getSheetData already returns rows as an array of objects/arrays
      const rawRows = [headers, ...dataRows.map(row => headers.map(header => row[header]))]; // Reconstroi o array de arrays para groupRows
      const { clients, filters } = await groupRows(rawRows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      if (req.query.countOnly === '1') {
        return res.status(200).json({ total: clients.length });
      }

      return res.status(200).json({ clients: clients.slice(0, limit), filters });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      return res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { row, values } = req.body;

      if (values?.telefone_normalizado) {
        values.telefone_normalizado = values.telefone_normalizado
          .split(';')
          .map(protectPhoneValue)
          .join(';');
      }
      if (values?.tel) values.tel = protectPhoneValue(values.tel);
      if (values?.cel) values.cel = protectPhoneValue(values.cel);

      if (row) {
        await updateRow(row, values);
      } else {
        await appendRow(values);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      return res.status(500).json({ error: 'Erro ao salvar cliente' });
    }
  }

  return res.status(405).end();
}
