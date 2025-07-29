import { getSheetCached, updateRow } from '../../lib/googleSheets';

function groupRows(rows) {
  const [header, ...data] = rows;
  const idx = {
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

  const normalizePhone = (v) => String(v || '').trim();

  if (idx.tel === -1 || idx.cel === -1) {
    console.warn('Colunas de telefone não encontradas', { tel: idx.tel, cel: idx.cel });
  }

  const map = new Map();

  data.forEach((row, i) => {
    const company = row[idx.org];
    if (!company) return;

    if (!map.has(company)) {
      map.set(company, {
        id: company,
        company,
        opportunities: [],
        contactsMap: new Map(),
        segment: row[idx.segmento],
        size: row[idx.tamanho],
        uf: row[idx.uf],
        city: row[idx.cidade],
        status: row[idx.status],
        dataMov: row[idx.data],
        color: row[idx.cor],
        rows: [],
      });
    }

    const client = map.get(company);
    client.opportunities.push(row[idx.titulo]);
    client.rows.push(i + 2);

    const contactName = row[idx.contato];
    if (contactName && !client.contactsMap.has(contactName)) {
      const phone = normalizePhone(row[idx.tel]);
      const mobile = normalizePhone(row[idx.cel]);
      if (!phone && !mobile) {
        console.warn('Contato sem telefone', { row: i + 2, company });
      }
      client.contactsMap.set(contactName, {
        name: contactName.trim(),
        role: (row[idx.cargo] || '').trim(),
        email: (row[idx.email] || '').trim(),
        phone,
        mobile,
        linkedin: (row[idx.linkedin] || '').trim(),
      });
    }
  });

  return {
    header,
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

    let existingColor = '';
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const [header, ...data] = rows;
    const colorIdx = header.indexOf('Cor_Card');
    let companyIdx = header.indexOf('Negócio - Organização');
    if (companyIdx === -1) companyIdx = header.indexOf('Organização - Nome');

    const promises = [];
    data.forEach((row, i) => {
      if (row[companyIdx] === id) {
        const rowNum = i + 2;
        if (existingColor === '') existingColor = row[colorIdx] || '';

        const values = {
          data_ultima_movimentacao: new Date().toISOString().split('T')[0],
        };
        if (newStatus !== undefined) values.status_kanban = newStatus;
        if (newColor !== undefined) values.cor_card = newColor;
        promises.push(updateRow(rowNum, values));
      }
    });

    await Promise.all(promises);
    return res
      .status(200)
      .json({ status: newStatus, color: newColor ?? existingColor });
  }

  return res.status(405).end();
}

