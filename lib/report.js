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
      impresso: row[idx.impresso] || '',
    });

    if (row[idx.segmento]) filters.segmento.add(row[idx.segmento]);
    if (row[idx.tamanho]) filters.porte.add(row[idx.tamanho]);
    if (row[idx.uf]) filters.uf.add(row[idx.uf]);
    if (row[idx.cidade]) filters.cidade.add(row[idx.cidade]);
  });

  return { map, filters };
}

export function mapToRows(map, query = {}, max = Infinity, onlyNew = true) {
  const result = [];
  const toMark = new Set();
  const seen = new Set(); // ✅ Evita duplicidade

  map.forEach((item) => {
    if (query.segmento && item.segment !== query.segmento) return;

    if (query.porte) {
      const selected = Array.isArray(query.porte)
        ? query.porte
        : query.porte.split(',');
      if (!selected.includes(item.size)) return;
    }

    if (query.uf && item.uf !== query.uf) return;
    if (query.cidade && item.cidade !== query.cidade) return;

    if (result.length >= max) return;

    const contatos = item.contacts.length === 0
      ? [{
          nome: '',
          cargo: '',
          telefone: '',
          celular: '',
          email: '',
          linkedin: '',
          impresso: '',
        }]
      : item.contacts;

    contatos.forEach((c) => {
      if (result.length >= max) return;

      // ✅ Se "Somente Leads Inéditos" estiver ativo, ignora contatos já marcados como "Em Lista"
      if (onlyNew && c.impresso === 'Em Lista') return;

      // ✅ Cria chave única para evitar duplicados
      const key = `${item.company}|${c.nome}|${c.telefone}|${c.celular}|${c.email}|${c.linkedin}`;
      if (seen.has(key)) return;
      seen.add(key);

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

      item.rows.forEach((r) => toMark.add(r));
    });
  });

  return { rows: result, toMark };
}

export async function markPrintedRows(updateRowFn, rows) {
  await Promise.all(
    Array.from(rows).map((rowNum) =>
      updateRowFn(rowNum, { impresso_lista: 'Em Lista' }) // ✅ Marca corretamente na planilha
    )
  );
}

