import { getSheet, appendRow, updateRow } from '../../lib/googleSheets';

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

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const map = new Map();

  data.forEach((row, i) => {
    const company = row[idx.org];
    if (!company) return;
    if (!map.has(company)) {
      map.set(company, {
        id: company,
        company,
        opportunities: [],
        contactsMap: new Map(),
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        city: row[idx.cidade] || '',
        status: row[idx.status] || '',
        dataMov: row[idx.data] || '',
       color: row[idx.cor] || '',        
      });
    }

    const item = map.get(company);
    if (row[idx.titulo]) item.opportunities.push(row[idx.titulo]);
    const key = `${row[idx.contato] || ''}|${row[idx.email] || ''}`;
    if (!item.contactsMap.has(key)) {
      item.contactsMap.set(key, {
        nome: row[idx.contato] || '',
        cargo: row[idx.cargo] || '',
        email: row[idx.email] || '',
        telefone: row[idx.tel] || '',
        celular: row[idx.cel] || '',
        linkedin_contato: row[idx.linkedin] || '',
       });
    }

    if (row[idx.segmento]) filters.segmento.add(row[idx.segmento]);
    if (row[idx.tamanho]) filters.porte.add(row[idx.tamanho]);
    if (row[idx.uf]) filters.uf.add(row[idx.uf]);
    if (row[idx.cidade]) filters.cidade.add(row[idx.cidade]);
  });

  const clients = Array.from(map.values()).map((c) => ({
    id: c.id,
    company: c.company,
    opportunities: Array.from(new Set(c.opportunities)),
    contacts: Array.from(c.contactsMap.values()),
    segment: c.segment,
    size: c.size,
    uf: c.uf,
    city: c.city,
    status: c.status,
    dataMov: c.dataMov,
    color: c.color,    
  }));

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
    const sheet = await getSheet();
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

