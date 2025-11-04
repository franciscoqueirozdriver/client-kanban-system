import { getSheetCached, appendRow, updateRow } from '../../lib/googleSheets';
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

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('cliente_id'),
    org: header.indexOf('organizacao_nome'),
    titulo: header.indexOf('negocio_titulo'),
    contato: header.indexOf('negocio_pessoa_de_contato'),
    cargo: header.indexOf('pessoa_cargo'),
    emailWork: header.indexOf('pessoa_email_work'),
    emailHome: header.indexOf('pessoa_email_home'),
    emailOther: header.indexOf('pessoa_email_other'),
    phoneWork: header.indexOf('pessoa_phone_work'),
    phoneHome: header.indexOf('pessoa_phone_home'),
    phoneMobile: header.indexOf('pessoa_phone_mobile'),
    phoneOther: header.indexOf('pessoa_phone_other'),
    tel: header.indexOf('pessoa_telefone'),
    cel: header.indexOf('pessoa_celular'),
    normalizado: header.indexOf('telefone_normalizado'),
    segmento: header.indexOf('organizacao_segmento'),
    tamanho: header.indexOf('organizacao_tamanho_da_empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('status_kanban'),
    data: header.indexOf('data_ultima_movimentacao'),
    linkedin: header.indexOf('pessoa_end_linkedin'),
    cor: header.indexOf('cor_card'),
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

    if (!clienteId) return; // Ignora linhas sem Cliente_ID
    if (!company) return; // Ignora linhas sem nome da empresa
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
      const sheet = await getSheetCached('Sheet1');
      if (!sheet || !sheet.data || !sheet.data.values) {
        throw new Error('Falha ao obter dados da planilha ou dados vazios.');
      }
      const rows = sheet.data.values;
      const { clients, filters } = groupRows(rows);

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
