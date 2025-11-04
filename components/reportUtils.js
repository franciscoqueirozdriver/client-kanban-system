export function normalizePhones(row, idx) {
  const val = (key) => (row[key] ? String(row[key] || '').trim() : '');
  const existing = val('telefone_normalizado');
  const rawList = [
    val('pessoa_phone_work'),
    val('pessoa_phone_home'),
    val('pessoa_phone_mobile'),
    val('pessoa_phone_other'),
    val('pessoa_telefone'),
    val('pessoa_celular'),
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

export function buildReport(rows) {
  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const map = new Map();
  rows.forEach((row, i) => {
    const company = row.organizacao_nome;
    if (!company) return;
    if (row.impresso_lista) return;

    if (!map.has(company)) {
      map.set(company, {
        company,
        segment: row.organizacao_segmento || '',
        size: row.organizacao_tamanho_da_empresa || '',
        uf: row.uf || '',
        cidade: row.cidade_estimada || '',
        contacts: [],
        rows: [],
      });
    }
    const item = map.get(company);
    item.rows.push(i + 2);

    const telefone = String(row.pessoa_telefone || '').trim();
    const celular = String(row.pessoa_celular || '').trim();
    const normalizedPhones = normalizePhones(row);
    if (normalizedPhones.length === 0) {
      console.warn('Contato sem telefone', { row: i + 2, company });
    }

    item.contacts.push({
      nome: (row.negocio_pessoa_de_contato || '').trim(),
      cargo: (row.pessoa_cargo || '').trim(),
      telefone,
      celular,
      normalizedPhones,
      email: (row.pessoa_email_work || '').trim(),
      linkedin: (row.pessoa_end_linkedin || '').trim(),
    });

    if (row.organizacao_segmento) filters.segmento.add(row.organizacao_segmento);
    if (row.organizacao_tamanho_da_empresa) filters.porte.add(row.organizacao_tamanho_da_empresa);
    if (row.uf) filters.uf.add(row.uf);
    if (row.cidade_estimada) filters.cidade.add(row.cidade_estimada);
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
        normalizedPhones: [],
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
          normalizedPhones: c.normalizedPhones || [],
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
