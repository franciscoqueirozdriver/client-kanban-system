import { getSheetCached, appendRow, updateRow } from '../../lib/googleSheets';
import { normalizePhones } from '../../lib/report';

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('Cliente_ID'),
    org: header.indexOf('Organização - Nome'),
    titulo: header.indexOf('Negócio - Título'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    email: header.indexOf('Pessoa - Email - Work'),
    phoneWork: header.indexOf('Pessoa - Phone - Work'),
    phoneHome: header.indexOf('Pessoa - Phone - Home'),
    phoneMobile: header.indexOf('Pessoa - Phone - Mobile'),
    phoneOther: header.indexOf('Pessoa - Phone - Other'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    normalizado: header.indexOf('Telefone Normalizado'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('Status_Kanban'),
    data: header.indexOf('Data_Ultima_Movimentacao'),
    linkedin: header.indexOf('Pessoa - End. Linkedin'),
    cor: header.indexOf('Cor_Card'),
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
      email: (row[idx.email] || '').trim(),
      phone: (row[idx.tel] || '').trim(),
      mobile: (row[idx.cel] || '').trim(),
      normalizedPhones: normalizePhones(row, idx),
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
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const { clients, filters } = groupRows(rows);
    return res.status(200).json({ clients, filters });
  }

  if (req.method === 'POST') {
    const { row, values } = req.body;
    if (row) {
      await updateRow(row, values);
    } else {
      await appendRow(values);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
