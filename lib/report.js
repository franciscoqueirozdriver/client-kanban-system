export function normalizePhones(row, idx) {
  const val = (i) => (i >= 0 ? String(row[i] || '').trim() : '');
  const existing = val(idx.normalizado);
  const rawList = [
    val(idx.phoneWork),
    val(idx.phoneHome),
    val(idx.phoneMobile),
    val(idx.phoneOther),
    val(idx.tel),
    val(idx.cel),
  ];

  if (existing) {
    return existing
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const numbers = rawList
    .map((p) => p.replace(/[\s().-]/g, ''))
    .map((p) => p.replace(/^0+/, ''))
    .map((p) => p.replace(/[^0-9+]/g, ''))
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('+')) p = p.slice(1);
      if (!p.startsWith('55')) {
        if (p.length === 10 || p.length === 11) p = '55' + p;
        else return null;
      }
      if (p.length === 12 || p.length === 13) return '+' + p;
      return null;
    })
    .filter(Boolean);

  return Array.from(new Set(numbers));
}

export async function saveNormalizedPhones(updateRowFn, rowNum, numbers) {
  const value = numbers.join(';');
  await updateRowFn(rowNum, { telefone_normalizado: value });
}

export function buildReport(rows) {
  const [header, ...data] = rows;
  const idx = {
    org: header.indexOf('Organização - Nome'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    phoneWork: header.indexOf('Pessoa - Phone - Work'),
    phoneHome: header.indexOf('Pessoa - Phone - Home'),
    phoneMobile: header.indexOf('Pessoa - Phone - Mobile'),
    phoneOther: header.indexOf('Pessoa - Phone - Other'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    normalizado: header.indexOf('Telefone Normalizado'),
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
    const normalizedPhones = normalizePhones(row, idx);
    if (normalizedPhones.length === 0) {
      console.warn('Contato sem telefone', { row: i + 2, company });
    }

    item.contacts.push({
      nome: (row[idx.contato] || '').trim(),
      cargo: (row[idx.cargo] || '').trim(),
      telefone,
      celular,
      normalizedPhones,
      email: (row[idx.email] || '').trim(),
      linkedin: (row[idx.linkedin] || '').trim(),
      impresso: (row[idx.impresso] || '').trim(),
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
      const key = `${item.company}|${c.nome}|${c.telefone}|${c.celular}|${c.email}|${c.linkedin}|${(c.normalizedPhones || []).join(',')}`;
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
        normalizedPhones: c.normalizedPhones || [],
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


