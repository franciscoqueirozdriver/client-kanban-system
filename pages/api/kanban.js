import { getSheet, updateRow } from '../../lib/googleSheets';

function columnToLetter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

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
  };

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
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        city: row[idx.cidade] || '',
        status: row[idx.status] || '',
        dataMov: row[idx.data] || '',
        rows: [],
        header,
      });
    }

    const item = map.get(company);
    item.rows.push(i + 2);
    if (row[idx.titulo]) item.opportunities.push(row[idx.titulo]);
    const key = `${row[idx.contato] || ''}|${row[idx.email] || ''}`;
    if (!item.contactsMap.has(key)) {
      item.contactsMap.set(key, {
        nome: row[idx.contato] || '',
        cargo: row[idx.cargo] || '',
        email: row[idx.email] || '',
        telefone: row[idx.tel] || '',
        celular: row[idx.cel] || '',
      });
    }
  });

  return { header, clients: Array.from(map.values()).map((c) => ({
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
    rows: c.rows,
  })) };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sheet = await getSheet();
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
    const { id, destination } = req.body;
    const sheet = await getSheet();
    const rows = sheet.data.values || [];
    const [header, ...data] = rows;
    const companyIdx = header.indexOf('Organização - Nome');
    const statusIdx = header.indexOf('Status_Kanban');
    const dateIdx = header.indexOf('Data_Ultima_Movimentacao');
    const statusLetter = columnToLetter(statusIdx);
    const dateLetter = columnToLetter(dateIdx);
    const promises = [];
    data.forEach((row, i) => {
      if (row[companyIdx] === id) {
        const rowNum = i + 2;
        promises.push(
          updateRow(`Clientes!${statusLetter}${rowNum}:${dateLetter}${rowNum}`, [
            destination.droppableId,
            new Date().toISOString().split('T')[0],
          ])
        );
      }
    });
    await Promise.all(promises);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
