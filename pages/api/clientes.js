import { getSheetCached, appendRow, updateRow } from '../../lib/googleSheets';

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    org: header.indexOf('Organização - Nome'),
    titulo: header.indexOf('Negócio - Título'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    email: header.indexOf('Pessoa - Email - Work'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('Status_Kanban'),
    data: header.indexOf('Data_Ultima_Movimentacao'),
    linkedin: header.indexOf('Pessoa - End. Linkedin'),
    cor: header.indexOf('Cor_Card'),
  };

  const normalizePhone = (v) => String(v || '').trim();

  if (idx.tel === -1 || idx.cel === -1) {
    console.warn('Colunas de telefone não encontradas', { tel: idx.tel, cel: idx.cel });
  }

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const clients = data.map((row, i) => {
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

    const phone = normalizePhone(row[idx.tel]);
    const mobile = normalizePhone(row[idx.cel]);
    if (!phone && !mobile) {
      console.warn('Contato sem telefone', { row: i + 2, company });
    }

    const contact = {
      name: (row[idx.contato] || '').trim(),
      role: (row[idx.cargo] || '').trim(),
      email: (row[idx.email] || '').trim(),
      phone,
      mobile,
      linkedin: (row[idx.linkedin] || '').trim(),
    };

    return {
      company,
      opportunities: [row[idx.titulo] || ''],
      contacts: [contact],
      segment,
      size,
      uf,
      city,
      status,
      dataMov,
      color,
    };
  });

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

