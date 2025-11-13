import { getSheetCached, appendRow, updateRow, getSheetData } from '../../lib/googleSheets';
import { buildColumnResolver } from '../../lib/sheets/headerResolver';
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
  const SHEET = 'Sheet1';
  const COL = await buildColumnResolver(SHEET);
  const idx = {
    clienteId: header.indexOf(COL('Cliente_ID')),
    org: header.indexOf(COL('Organização - Nome')),
    titulo: header.indexOf(COL('Negócio - Título')),
    contato: header.indexOf(COL('Negócio - Pessoa de contato')),
    cargo: header.indexOf(COL('Pessoa - Cargo')),
    emailWork: header.indexOf(COL('Pessoa - Email - Work')),
    emailHome: header.indexOf(COL('Pessoa - Email - Home')),
    emailOther: header.indexOf(COL('Pessoa - Email - Other')),
    phoneWork: header.indexOf(COL('Pessoa - Phone - Work')),
    phoneHome: header.indexOf(COL('Pessoa - Phone - Home')),
    phoneMobile: header.indexOf(COL('Pessoa - Phone - Mobile')),
    phoneOther: header.indexOf(COL('Pessoa - Phone - Other')),
    tel: header.indexOf(COL('Pessoa - Telefone')),
    cel: header.indexOf(COL('Pessoa - Celular')),
    normalizado: header.indexOf(COL('Telefone Normalizado')),
    segmento: header.indexOf(COL('Organização - Segmento')),
    tamanho: header.indexOf(COL('Organização - Tamanho da empresa')),
    uf: header.indexOf(COL('uf')),
    cidade: header.indexOf(COL('cidade_estimada')),
    status: header.indexOf(COL('Status_Kanban')),
    data: header.indexOf(COL('Data_Ultima_Movimentacao')),
    linkedin: header.indexOf(COL('Pessoa - End. Linkedin')),
    cor: header.indexOf(COL('Cor_Card')),
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
      const { headers, rows: dataRows } = await getSheetData('sheet1');
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
      return res.status(200).json({ clients: [], filters: {} });
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
