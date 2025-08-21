import { getSheetCached, updateRow } from '../../lib/googleSheets';
import { normalizePhones } from '../../lib/report';

// ✅ Protege números de telefone para salvar como texto no Sheets
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}

// ✅ Junta os 3 tipos de e-mail e remove duplicados
function collectEmails(row, idx) {
  const emails = [
    idx.emailWork >= 0 ? row[idx.emailWork] || '' : '',
    idx.emailHome >= 0 ? row[idx.emailHome] || '' : '',
    idx.emailOther >= 0 ? row[idx.emailOther] || '' : '',
  ]
    .map((e) => String(e).trim())
    .filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function groupRows(rows) {
  const [header, ...data] = rows;
  const norm = (s) => (s || '').toString().toLowerCase().replace(/[\s_]+/g, ' ').trim();
  const hIndex = (name) => header.findIndex((h) => norm(h) === norm(name));
  const idx = {
    clienteId: hIndex('Cliente_ID'),
    org: hIndex('Organização - Nome'),
    titulo: hIndex('Negócio - Título'),
    contato: hIndex('Negócio - Pessoa de contato'),
    cargo: hIndex('Pessoa - Cargo'),
    emailWork: hIndex('Pessoa - Email - Work'),
    emailHome: hIndex('Pessoa - Email - Home'),
    emailOther: hIndex('Pessoa - Email - Other'),
    phoneWork: hIndex('Pessoa - Phone - Work'),
    phoneHome: hIndex('Pessoa - Phone - Home'),
    phoneMobile: hIndex('Pessoa - Phone - Mobile'),
    phoneOther: hIndex('Pessoa - Phone - Other'),
    tel: hIndex('Pessoa - Telefone'),
    cel: hIndex('Pessoa - Celular'),
    normalizado: hIndex('Telefone Normalizado'),
    segmento: hIndex('Organização - Segmento'),
    tamanho: hIndex('Organização - Tamanho da empresa'),
    uf: hIndex('uf'),
    cidade: hIndex('cidade_estimada'),
    status: hIndex('Status Kanban'),
    data: hIndex('Data Ultima Movimentacao'),
    linkedin: hIndex('Pessoa - End. Linkedin'),
    cor: hIndex('Cor Card'),
  };

  const map = new Map();

  data.forEach((row, i) => {
    const clienteId = idx.clienteId >= 0 ? row[idx.clienteId] : '';
    if (!clienteId) return;

    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: idx.org >= 0 ? row[idx.org] || '' : '',
        opportunities: [],
        contactsMap: new Map(),
        segment: idx.segmento >= 0 ? row[idx.segmento] || '' : '',
        size: idx.tamanho >= 0 ? row[idx.tamanho] || '' : '',
        uf: idx.uf >= 0 ? row[idx.uf] || '' : '',
        city: idx.cidade >= 0 ? row[idx.cidade] || '' : '',
        status: idx.status >= 0 ? row[idx.status] || '' : '',
        dataMov: idx.data >= 0 ? row[idx.data] || '' : '',
        color: idx.cor >= 0 ? row[idx.cor] || '' : '',
        rows: [],
      });
    }

    const client = map.get(clienteId);
    client.opportunities.push(idx.titulo >= 0 ? row[idx.titulo] || '' : '');
    client.rows.push(i + 2);

    const contactName = idx.contato >= 0 ? (row[idx.contato] || '').trim() : '';
    const allEmails = collectEmails(row, idx);
    const key = `${contactName}|${allEmails}`;

    if (!client.contactsMap.has(key)) {
      const normalized = normalizePhones(row, idx).map(protectPhoneValue);
      client.contactsMap.set(key, {
        name: contactName,
        role: idx.cargo >= 0 ? (row[idx.cargo] || '').trim() : '',
        email: allEmails,
        phone: idx.tel >= 0 ? protectPhoneValue(row[idx.tel]) : '',
        mobile: idx.cel >= 0 ? protectPhoneValue(row[idx.cel]) : '',
        normalizedPhones: normalized,
        linkedin: idx.linkedin >= 0 ? (row[idx.linkedin] || '').trim() : '',
      });
    }
  });

  return {
    clients: Array.from(map.values()).map((c) => ({
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
      rows: c.rows,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const { clients } = groupRows(rows);

    const columns = [
      'Lead Selecionado',
      'Tentativa de Contato',
      'Contato Efetuado',
      'Conversa Iniciada',
      'Reunião Agendada',
      'Perdido',
    ];
    const board = columns.map((col) => ({ id: col, title: col, cards: [] }));

    clients.forEach((client) => {
      const col = board.find((c) => c.id === client.status);
      if (col) {
        col.cards.push({ id: client.id, client });
      }
    });

    return res.status(200).json(board);
  }

  if (req.method === 'POST') {
    const { id, destination, status, color } = req.body;
    const newStatus = status || (destination && destination.droppableId);
    const newColor =
      color !== undefined
        ? color
        : newStatus === 'Perdido'
        ? 'red'
        : undefined;

    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const [header, ...data] = rows;

    const norm = (s) => (s || '').toString().toLowerCase().replace(/[\s_]+/g, ' ').trim();
    const hIndex = (name) => header.findIndex((h) => norm(h) === norm(name));

    const clienteIdIdx = hIndex('Cliente_ID');
    const colorIdx = hIndex('Cor Card');
    const statusIdx = hIndex('Status Kanban');

    const promises = [];

    data.forEach((row, i) => {
      if (row[clienteIdIdx] === id) {
        const rowNum = i + 2;
        const values = {};
        if (newStatus !== undefined && statusIdx !== -1) {
          values['Status Kanban'] = newStatus;
        }
        if (newColor !== undefined && colorIdx !== -1) {
          values['Cor Card'] = newColor;
        }
        values['Data Ultima Movimentacao'] = new Date().toISOString().split('T')[0];
        promises.push(updateRow(rowNum, values));
      }
    });

    await Promise.all(promises);
    return res.status(200).json({ status: newStatus, color: newColor });
  }

  return res.status(405).end();
}
