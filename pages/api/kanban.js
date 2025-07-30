import { getSheetCached, updateRow } from '../../lib/googleSheets';
import { normalizePhones } from '../../lib/report';

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('Cliente_ID'),
    org: header.indexOf('Organização - Nome'),
    titulo: header.indexOf('Negócio - Título'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    email: header.indexOf('Pessoa - Email - Work'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
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

    const contactName = row[idx.contato];
    if (contactName && !client.contactsMap.has(contactName)) {
      client.contactsMap.set(contactName, {
        name: contactName.trim(),
        role: (row[idx.cargo] || '').trim(),
        email: (row[idx.email] || '').trim(),
        phone: (row[idx.tel] || '').trim(),
        mobile: (row[idx.cel] || '').trim(),
        normalizedPhones: normalizePhones(row, idx),
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
  }

  return res.status(405).end();
}
