import { updateRow, getSheetData } from './googleSheets';
import { buildColumnResolver } from './sheets/headerResolver';

/**
 * Normaliza todos os números e protege contra erros do Google Sheets.
 */
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

  // ✅ Se já existe "Telefone Normalizado", usa ele
  if (existing) {
    return existing
      .split(/[,;/]/)
      .map((p) => `'${p.trim().replace(/^'+/, '')}`) // sempre como texto puro
      .filter(Boolean);
  }

  // ✅ Junta e separa todos os números encontrados
  let allNumbers = rawList
    .join(';')
    .split(/[,;/]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const normalized = new Set();

  for (let num of allNumbers) {
    let original = num;

    // 🔹 Remove caracteres não numéricos (exceto +)
    num = num.replace(/[^\d+]/g, '');

    // 🔹 Remove códigos de operadora tipo 031
    num = num.replace(/^(0\d{2})(\d{8,9})$/, '$2');

    const digitsOnly = num.replace(/\D/g, '');
    if (digitsOnly.length < 8) continue;

    // 🔹 Mantém números 0800 e 4003
    if (/^0800\d{6,7}$/.test(digitsOnly) || /^4003\d{4}$/.test(digitsOnly)) {
      normalized.add(`'${digitsOnly}`);
      continue;
    }

    // 🔹 Aceita número internacional já no formato +E.164
    if (/^\+\d{10,15}$/.test(num)) {
      normalized.add(`'${num}`);
      continue;
    }

    // 🔹 Remove + duplicado e garante padrão Brasil
    if (num.startsWith('+')) num = num.slice(1);

        if (!num.startsWith('55')) {
      if (digitsOnly.length === 10 || digitsOnly.length === 11) {
        num = '55' + digitsOnly;
      } else {
        continue;
      }
    }

    if (num.length === 12 || num.length === 13) {
      normalized.add(`'+${num}`);
    }
  }

  return Array.from(normalized);
}

/**
 * Salva os telefones normalizados protegendo como texto puro.
 */
export async function saveNormalizedPhones(updateRowFn, rowNum, numbers) {
  const safeNumbers = numbers.map((n) => (n.startsWith("'") ? n : `'${n}`));
  const value = safeNumbers.join(';');
  await updateRowFn(rowNum, { telefone_normalizado: value });
}

export async function buildReport(rows, { savePhones = true } = {}) {
  const SHEET = 'Sheet1';
  const COL = await buildColumnResolver(SHEET);
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf(COL('Cliente_ID')),
    org: header.indexOf(COL('Organização - Nome')),
    segmento: header.indexOf(COL('Organização - Segmento')),
    tamanho: header.indexOf(COL('Organização - Tamanho da empresa')),
    contato: header.indexOf(COL('Negócio - Pessoa de contato')),
    cargo: header.indexOf(COL('Pessoa - Cargo')),
    phoneWork: header.indexOf(COL('Pessoa - Phone - Work')),
    phoneHome: header.indexOf(COL('Pessoa - Phone - Home')),
    phoneMobile: header.indexOf(COL('Pessoa - Phone - Mobile')),
    phoneOther: header.indexOf(COL('Pessoa - Phone - Other')),
    tel: header.indexOf(COL('Pessoa - Telefone')),
    cel: header.indexOf(COL('Pessoa - Celular')),
    normalizado: header.indexOf(COL('Telefone Normalizado')),
    email: header.indexOf(COL('Pessoa - Email - Work')),
    linkedin: header.indexOf(COL('Pessoa - End. Linkedin')),
    uf: header.indexOf(COL('uf')),
    cidade: header.indexOf(COL('cidade_estimada')),
    impresso: header.indexOf(COL('Impresso_Lista')),
  };

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const map = new Map();
  const phoneUpdates = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const clienteId = row[idx.clienteId];
    if (!clienteId) continue;

    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row[idx.org] || '',
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        cidade: row[idx.cidade] || '',
        contacts: [],
        rows: [],
      });
    }

    const item = map.get(clienteId);
    item.rows.push(i + 2);

    const normalizedPhones = normalizePhones(row, idx);

    if (
      savePhones &&
      idx.normalizado >= 0 &&
      normalizedPhones.length > 0 &&
      !row[idx.normalizado]
    ) {
      phoneUpdates.push(
        saveNormalizedPhones(updateRow, i + 2, normalizedPhones).catch((err) => {
          console.error('Erro ao salvar telefone normalizado', {
            row: i + 2,
            err,
          });
        })
      );
    }

    item.contacts.push({
      nome: (row[idx.contato] || '').trim(),
      cargo: (row[idx.cargo] || '').trim(),
      telefone: (row[idx.tel] || '').trim(),
      celular: (row[idx.cel] || '').trim(),
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

  if (phoneUpdates.length) {
    await Promise.all(phoneUpdates);
  }

  console.log('buildReport:', {
    linhasProcessadas: data.length,
    clientes: map.size,
  });

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

      const key = `${item.id}|${c.nome}|${c.telefone}|${c.celular}|${c.email}|${c.linkedin}|${(c.normalizedPhones || []).join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);

      result.push({
        id: item.id,
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

  console.log('mapToRows:', {
    totalSelecionados: result.length,
    marcar: Array.from(toMark).length,
  });

  return { rows: result, toMark };
}

export async function markPrintedRows(updateRowFn, rows) {
  const SHEET = 'sheet1';
  const COL = await buildColumnResolver(SHEET);
  await Promise.all(    Array.from(rows).map((rowNum) =>
      updateRowFn(rowNum, { [COL('Impresso_Lista')]: 'Em Lista' })
    ));
}
