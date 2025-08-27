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
    row[idx.emailWork] || '',
    row[idx.emailHome] || '',
    row[idx.emailOther] || '',
  ]
    .map((e) => String(e).trim())
    .filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('Cliente_ID'),
    org: header.indexOf('Organização - Nome'),
    titulo: header.indexOf('Negócio - Título'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    emailWork: header.indexOf('Pessoa - Email - Work'),
    emailHome: header.indexOf('Pessoa - Email - Home'),
    emailOther: header.indexOf('Pessoa - Email - Other'),
    phoneWork: header.indexOf('Pessoa - Phone - Work'),
    phoneHome: header.indexOf('Pessoa - Phone - Home'),
    phoneMobile: header.indexOf('Pessoa - Phone - Mobile'),
    phoneOther: header.indexOf('Pessoa - Phone - Other'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    normalizado: header.indexOf('Telefone Normalizado'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('Status_Kanban'),
    data: header.indexOf('Data_Ultima_Movimentacao'),
    linkedin: header.indexOf('Pessoa - End. Linkedin'),
    cor: header.indexOf('Cor_Card'),
  };

  const map = new Map();

  data.forEach((row, i) => {
    const clienteId = row[idx.clienteId];
    if (!clienteId) return;

    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row[idx.org] || '',
        opportunities: [],
        contactsMap: new Map(),
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        city: row[idx.cidade] || '',
        status: row[idx.status] || '',
        dataMov: row[idx.data] || '',
        color: row[idx.cor] || '',
        rows: [],
      });
    }

    const client = map.get(clienteId);
    client.opportunities.push(row[idx.titulo] || '');
    client.rows.push(i + 2);

    const contactName = (row[idx.contato] || '').trim();
    const allEmails = collectEmails(row, idx);
    const key = `${contactName}|${allEmails}`;

    if (!client.contactsMap.has(key)) {
      const normalized = normalizePhones(row, idx).map(protectPhoneValue);
      client.contactsMap.set(key, {
        name: contactName,
        role: (row[idx.cargo] || '').trim(),
        email: allEmails,
        phone: protectPhoneValue(row[idx.tel]),
        mobile: protectPhoneValue(row[idx.cel]),
        normalizedPhones: normalized,
        linkedin: (row[idx.linkedin] || '').trim(),
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
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
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

      (limit ? clients.slice(0, limit) : clients).forEach((client) => {
        const col = board.find((c) => c.id === client.status);
        if (col) {
          col.cards.push({ id: client.id, client });
        }
      });

      return res.status(200).json(board);
    } catch (err) {
      console.error('Erro ao listar kanban:', err);
      return res.status(500).json({ error: 'Erro ao listar kanban' });
    }
  }

  if (req.method === 'POST') {
    try {
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

      const clienteIdIdx = header.indexOf('Cliente_ID');
      const colorIdx = header.indexOf('Cor_Card');
      const statusIdx = header.indexOf('Status_Kanban');

      const promises = [];

      data.forEach((row, i) => {
        if (row[clienteIdIdx] === id) {
          const rowNum = i + 2;
          const values = {};
          if (newStatus !== undefined && statusIdx !== -1) {
            values.status_kanban = newStatus;
          }
          if (newColor !== undefined && colorIdx !== -1) {
            values.cor_card = newColor;
          }
          values.data_ultima_movimentacao = new Date().toISOString().split('T')[0];
          promises.push(updateRow(rowNum, values));
        }
      });

      await Promise.all(promises);
      return res.status(200).json({ status: newStatus, color: newColor });
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      return res.status(500).json({ error: 'Erro ao atualizar kanban' });
    }
  }

  return res.status(405).end();
}
