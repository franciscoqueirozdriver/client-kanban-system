// components/reportUtils.js

export function buildReport(rows) {
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

    const telefone = normalizePhone(row[idx.tel]);
    const celular = normalizePhone(row[idx.cel]);
    if (!telefone && !celular) {
      console.warn('Contato sem telefone', { row: i + 2, company });
    }

    item.contacts.push({
      nome: (row[idx.contato] || '').trim(),
      cargo: (row[idx.cargo] || '').trim(),
      telefone,
      celular,
      email: (row[idx.email] || '').trim(),
      linkedin: (row[idx.linkedin] || '').trim(),
    });

    if (row[idx.segmento]) filters.segmento.add(row[idx.segmento]);
    if (row[idx.tamanho]) filters.porte.add(row[idx.tamanho]);
    if (row[idx.uf]) filters.uf.add(row[idx.uf]);
    if (row[idx.cidade]) filters.cidade.add(row[idx.cidade]);
  });

  return { map, filters };
}

export function mapToRows(map, query = {}, max = Infinity) {
  const result = [];
  const toMark = new Set();

  map.forEach((item) => {
    if (query.segmento && item.segment !== query.segmento) return;
    if (query.porte && item.size !== query.porte) return;
    if (query.uf && item.uf !== query.uf) return;
    if (query.cidade && item.cidade !== query.cidade) return;

    if (result.length >= max) return;

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
        if (result.length >= max) return;
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

  return { rows: result, toMark };
}

export async function markPrintedRows(updateRowFn, rows) {
  await Promise.all(
    Array.from(rows).map((rowNum) => updateRowFn(rowNum, { impresso_lista: 'Em Lista' }))
  );
}

