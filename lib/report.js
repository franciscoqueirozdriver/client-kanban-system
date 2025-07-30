import { updateRow } from './googleSheets';

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

  // ✅ Se já existe na coluna "Telefone Normalizado", usa direto
  if (existing) {
    return existing
      .split(/[,;/]/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // ✅ Junta todos os telefones e separa por delimitadores
  let allNumbers = rawList
    .join(';')
    .split(/[,;/]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const normalized = new Set();

  for (let num of allNumbers) {
    let original = num;

    // 🔹 Remove qualquer texto que não seja número ou +
    num = num.replace(/[^\d+]/g, '');

    // 🔹 Remove códigos de operadora (031, 014)
    num = num.replace(/^(0\d{2})(\d{8,9})$/, '$2');

    // 🔹 Ramais e números curtos (<8 dígitos)
    const digitsOnly = num.replace(/\D/g, '');
    if (digitsOnly.length < 8) {
      console.warn('Telefone curto/ramal descartado:', original);
      continue;
    }

    // 🔹 Números 0800 e 4003 - mantém formato puro
    if (/^0800\d{6,7}$/.test(digitsOnly) || /^4003\d{4}$/.test(digitsOnly)) {
      normalized.add(digitsOnly);
      continue;
    }

    // 🔹 Números internacionais válidos (+XX...)
    if (/^\+\d{10,15}$/.test(num)) {
      normalized.add(num);
      continue;
    }

    // 🔹 Remove + duplicado e garante padrão
    if (num.startsWith('+')) num = num.slice(1);

    // 🔹 Adiciona +55 se não tiver DDI e for número brasileiro
    if (!num.startsWith('55')) {
      if (digitsOnly.length === 10 || digitsOnly.length === 11) {
        num = '55' + digitsOnly;
      } else {
        console.warn('Número descartado por formato inválido:', original);
        continue;
      }
    }

    // 🔹 Aceita apenas 12 ou 13 dígitos (E.164 para Brasil)
    if (num.length === 12 || num.length === 13) {
      normalized.add('+' + num);
    } else {
      console.warn('Número descartado por tamanho inválido:', original);
    }
  }

  return Array.from(normalized);
}

export async function saveNormalizedPhones(updateRowFn, rowNum, numbers) {
  const value = numbers.join(';');
  await updateRowFn(rowNum, { telefone_normalizado: value });
}

export async function buildReport(rows) {
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

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const map = new Map();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const company = row[idx.org];
    if (!company) continue;

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

    if (normalizedPhones.length > 0 && !row[idx.normalizado]) {
      try {
        await saveNormalizedPhones(updateRow, i + 2, normalizedPhones);
      } catch (err) {
        console.error('Erro ao salvar telefone normalizado', { row: i + 2, err });
      }
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
  }

  return { map, filters };
}

export function mapToRows(map, query = {}, max = Infinity, onlyNew = true) {
  const result = [];
  const toMark = new Set();
  const seen = new Set();

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
      if (onlyNew && c.impresso === 'Em Lista') return;

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
      updateRowFn(rowNum, { impresso_lista: 'Em Lista' })
    )
  );
}

