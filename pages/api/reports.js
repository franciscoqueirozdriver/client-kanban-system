import { getSheet, updateRow } from '../../lib/googleSheets';

function buildReport(rows) {
  const [header, ...data] = rows;
  const idx = {
    org: header.indexOf('Organização - Nome'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    email: header.indexOf('Pessoa - Email - Work'),
    linkedin: header.indexOf('Pessoa - End. Linkedin'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    impresso: header.indexOf('Impresso_Lista'),
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
    if (row[idx.impresso]) return;

    if (!map.has(company)) {
      map.set(company, {
        company,
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        cidade: row[idx.cidade] || '',
        contacts: [],
        rows: [],
      });
    }
    const item = map.get(company);
    item.rows.push(i + 2);
    item.contacts.push({
      nome: row[idx.contato] || '',
      cargo: row[idx.cargo] || '',
      telefone: row[idx.tel] || '',
      celular: row[idx.cel] || '',
      email: row[idx.email] || '',
      linkedin: row[idx.linkedin] || '',
    });

    if (row[idx.segmento]) filters.segmento.add(row[idx.segmento]);
    if (row[idx.tamanho]) filters.porte.add(row[idx.tamanho]);
    if (row[idx.uf]) filters.uf.add(row[idx.uf]);
    if (row[idx.cidade]) filters.cidade.add(row[idx.cidade]);
  });

  return { map, filters };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const sheet = await getSheet();
  const rows = sheet.data.values || [];
  const { map, filters } = buildReport(rows);

  const query = req.query || {};
  const result = [];
  const toMark = new Set();

  map.forEach((item) => {
    if (query.segmento && item.segment !== query.segmento) return;
    if (query.porte && item.size !== query.porte) return;
    if (query.uf && item.uf !== query.uf) return;
    if (query.cidade && item.cidade !== query.cidade) return;

    if (item.contacts.length === 0) {
      result.push({
        company: item.company,
        segment: item.segment,
        size: item.size,
        nome: '',
        cargo: '',
        telefone: '',
        celular: '',
        email: '',
        linkedin: '',
      });
    } else {
      item.contacts.forEach((c) => {
        result.push({
          company: item.company,
          segment: item.segment,
          size: item.size,
          nome: c.nome,
          cargo: c.cargo,
          telefone: c.telefone,
          celular: c.celular,
          email: c.email,
          linkedin: c.linkedin,
        });
      });
    }
    item.rows.forEach((r) => toMark.add(r));
  });

  await Promise.all(
    Array.from(toMark).map((rowNum) => updateRow(rowNum, { impresso_lista: 'Em Lista' }))
  );

  res.status(200).json({
    rows: result,
    filters: {
      segmento: Array.from(filters.segmento).sort(),
      porte: Array.from(filters.porte).sort(),
      uf: Array.from(filters.uf).sort(),
      cidade: Array.from(filters.cidade).sort(),
    },
  });
}
