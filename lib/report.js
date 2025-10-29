import { updateRow } from './googleSheets';

/**
 * Normaliza todos os números e protege contra erros do Google Sheets.
 */
export function normalizePhones(row) {
  const existing = row.telefone_normalizado || "";
  const rawList = [
    row.pessoa_phone_work || "",
    row.pessoa_phone_home || "",
    row.pessoa_phone_mobile || "",
    row.pessoa_phone_other || "",
    row.pessoa_telefone || "",
    row.pessoa_celular || "",
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
  const safeNumbers = numbers.map((n) => (n.startsWith("'") ? n : `\\'${n}`));
  const value = safeNumbers.join(";");
  await updateRowFn(rowNum, { "telefone_normalizado": value });
}

export async function buildReport({ headers, rows }, { savePhones = true } = {}) {
  const data = rows;


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
    const clienteId = row.cliente_id;
    if (!clienteId) continue;

if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row.organizacao_nome || "",
        segment: row.organizacao_segmento || "",
        size: row.organizacao_tamanho_da_empresa || "",
        uf: row.uf || "",
        cidade: row.cidade_estimada || "",
        contacts: [],
        rows: [],
      });
    }

    const item = map.get(clienteId);
    item.rows.push(i + 2);

    const normalizedPhones = normalizePhones(row);

    if (savePhones && normalizedPhones.length > 0 && !row.telefone_normalizado) {
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
      nome: (row.pessoa_nome || "").trim(),
      cargo: (row.cargo_contato || "").trim(),
      telefone: (row.pessoa_telefone || "").trim(),
      celular: (row.pessoa_celular || "").trim(),
      normalizedPhones,
      email: (row.pessoa_email_work || "").trim(),
      linkedin: (row.pessoa_end_linkedin || "").trim(),
      impresso: (row.impresso_lista || "").trim(),
    });

    if (row.organizacao_segmento) filters.segmento.add(row.organizacao_segmento);
    if (row.organizacao_tamanho_da_empresa) filters.porte.add(row.organizacao_tamanho_da_empresa);
    if (row.uf) filters.uf.add(row.uf);
    if (row.cidade_estimada) filters.cidade.add(row.cidade_estimada);
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
  await Promise.all(
    Array.from(rows).map((rowNum) =>
      updateRowFn(rowNum, { "impresso_lista": "Em Lista" })
    )
  );
}
