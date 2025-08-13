/**
 * Este arquivo contém utilitários para processamento e agregação de dados brutos do Google Sheets.
 */

/**
 * Normaliza todos os números de telefone de um cliente e protege contra erros do Google Sheets.
 * Esta função foi movida de `lib/report.js` para centralizar a lógica de dados.
 */
export function normalizePhones(row, idx) {
  const val = (header) => (idx[header] >= 0 ? String(row[idx[header]] || '').trim() : '');
  const existing = val('Telefone Normalizado');
  const rawList = [
    val('Pessoa - Phone - Work'),
    val('Pessoa - Phone - Home'),
    val('Pessoa - Phone - Mobile'),
    val('Pessoa - Phone - Other'),
    val('Pessoa - Telefone'),
    val('Pessoa - Celular'),
  ];

  if (existing) {
    return existing
      .split(/[,;/]/)
      .map((p) => `'${p.trim().replace(/^'+/, '')}`)
      .filter(Boolean);
  }

  const allNumbers = rawList
    .join(';')
    .split(/[,;/]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const normalized = new Set();

  for (let num of allNumbers) {
    num = num.replace(/[^\d+]/g, '');
    num = num.replace(/^(0\d{2})(\d{8,9})$/, '$2');

    const digitsOnly = num.replace(/\D/g, '');
    if (digitsOnly.length < 8) continue;

    if (/^0800\d{6,7}$/.test(digitsOnly) || /^4003\d{4}$/.test(digitsOnly)) {
      normalized.add(`'${digitsOnly}`);
      continue;
    }

    if (/^\+\d{10,15}$/.test(num)) {
      normalized.add(`'${num}`);
      continue;
    }

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
 * Coleta e unifica e-mails de diferentes colunas.
 */
function collectEmails(row, idx) {
  const emails = [
    (idx['Pessoa - Email - Work'] >= 0 ? row[idx['Pessoa - Email - Work']] : '') || '',
    (idx['Pessoa - Email - Home'] >= 0 ? row[idx['Pessoa - Email - Home']] : '') || '',
    (idx['Pessoa - Email - Other'] >= 0 ? row[idx['Pessoa - Email - Other']] : '') || '',
  ].map(e => String(e || '').trim()).filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

/**
 * Protege um valor de telefone para garantir que seja salvo como texto no Sheets.
 */
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}


/**
 * Função centralizada para agregar dados de clientes a partir das linhas do Google Sheet.
 * Substitui a lógica duplicada em `pages/api/clientes.js` e `lib/report.js`.
 *
 * @param {Array<Array<string>>} rows - As linhas de dados brutos do Google Sheets.
 * @returns {{clientMap: Map, filters: object}}
 */
export function aggregateClientData(rows) {
  const [header, ...data] = rows;

  // Mapeamento dinâmico de cabeçalhos para índices
  const idx = header.reduce((acc, h, i) => {
    acc[h] = i;
    return acc;
  }, {});

  const clientMap = new Map();
  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const val = (h) => (idx[h] >= 0 ? (row[idx[h]] || '') : '');

    const clienteId = val('Cliente_ID');
    if (!clienteId) return;

    // Adiciona aos filtros
    if (val('Organização - Segmento')) filters.segmento.add(val('Organização - Segmento'));
    if (val('Organização - Tamanho da empresa')) filters.porte.add(val('Organização - Tamanho da empresa'));
    if (val('uf')) filters.uf.add(val('uf'));
    if (val('cidade_estimada')) filters.cidade.add(val('cidade_estimada'));

    const contact = {
      name: (val('Negócio - Pessoa de contato') || '').trim(),
      role: (val('Pessoa - Cargo') || '').trim(),
      email: collectEmails(row, idx),
      phone: protectPhoneValue(val('Pessoa - Telefone')),
      mobile: protectPhoneValue(val('Pessoa - Celular')),
      normalizedPhones: normalizePhones(row, idx),
      linkedin: (val('Pessoa - End. Linkedin') || '').trim(),
      impresso: (val('Impresso_Lista') || '').trim(),
    };

    const opportunity = val('Negócio - Título') || '';

    if (clientMap.has(clienteId)) {
      const existing = clientMap.get(clienteId);
      existing.rows.push(rowNum);

      if (opportunity && !existing.opportunities.includes(opportunity)) {
        existing.opportunities.push(opportunity);
      }

      const existsContact = existing.contacts.find(
        (c) => c.name === contact.name && c.email === contact.email
      );
      if (!existsContact && (contact.name || contact.email)) {
        existing.contacts.push(contact);
      }
    } else {
      clientMap.set(clienteId, {
        id: clienteId,
        company: val('Organização - Nome'),
        opportunities: opportunity ? [opportunity] : [],
        contacts: contact.name || contact.email ? [contact] : [],
        segment: val('Organização - Segmento'),
        size: val('Organização - Tamanho da empresa'),
        uf: val('uf'),
        city: val('cidade_estimada'),
        status: val('Status_Kanban'),
        dataMov: val('Data_Ultima_Movimentacao'),
        color: val('Cor_Card'),
        rows: [rowNum],
      });
    }
  });

  return {
    clientMap,
    filters: {
      segmento: Array.from(filters.segmento).sort(),
      porte: Array.from(filters.porte).sort(),
      uf: Array.from(filters.uf).sort(),
      cidade: Array.from(filters.cidade).sort(),
    },
  };
}
