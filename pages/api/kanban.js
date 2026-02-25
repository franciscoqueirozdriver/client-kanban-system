import { getSheet, getSheetCached, findRowIndexById, updateRowByIndex, getSheetData } from '../../lib/googleSheets';
import { buildColumnResolver } from '../../lib/sheets/headerResolver';
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

async function groupRows(rows) {
  const [header, ...data] = rows;
  const SHEET = 'sheet1';
  const COL = await buildColumnResolver(SHEET);
  const idx = {
    clienteId: header.indexOf(COL('Cliente_ID')),
    org: header.indexOf(COL('Organização - Nome')),
    titulo: header.indexOf(COL('Negócio - Título')),
    contato: header.indexOf(COL('Negócio - Pessoa de contato')),
    cargo: header.indexOf(COL('Pessoa - Cargo')),
    emailWork: header.indexOf(COL('Pessoa - Email - Work')),
    emailHome: header.indexOf(COL('Pessoa - Email - Home')),
    emailOther: header.indexOf(COL('Pessoa - Email - Other')),
    phoneWork: header.indexOf(COL('Pessoa - Phone - Work')),
    phoneHome: header.indexOf(COL('Pessoa - Phone - Home')),
    phoneMobile: header.indexOf(COL('Pessoa - Phone - Mobile')),
    phoneOther: header.indexOf(COL('Pessoa - Phone - Other')),
    tel: header.indexOf(COL('Pessoa - Telefone')),
    cel: header.indexOf(COL('Pessoa - Celular')),
    normalizado: header.indexOf(COL('Telefone Normalizado')),
    segmento: header.indexOf(COL('Organização - Segmento')),
    tamanho: header.indexOf(COL('Organização - Tamanho da empresa')),
    uf: header.indexOf(COL('uf')),
    cidade: header.indexOf(COL('cidade_estimada')),
    status: header.indexOf(COL('Status_Kanban')),
    data: header.indexOf(COL('Data_Ultima_Movimentacao')),
    linkedin: header.indexOf(COL('Pessoa - End. Linkedin')),
    cor: header.indexOf(COL('Cor_Card')),
    produto: header.indexOf(COL('Negócio - Nome do produto')),
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
        status: '', // Will be overwritten by the latest row
        dataMov: '', // Will be overwritten by the latest row
        color: '', // Will be overwritten by the latest row
        produto: row[idx.produto] || '',
        rows: [],
      });
    }

    // Always update status and color to reflect the latest row for a given ID
    const client = map.get(clienteId);
    const newStatus = (row[idx.status] || '').trim();
    const newColor = row[idx.cor] || '';
    const newDataMov = row[idx.data] || '';

    if (newStatus) client.status = newStatus;
    if (newColor) client.color = newColor;
    if (newDataMov) client.dataMov = newDataMov;

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
      produto: c.produto,
      rows: c.rows,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { headers, rows: dataRows } = await getSheetData('sheet1');
      const rawRows = [headers, ...dataRows.map(row => headers.map(header => row[header]))]; // Reconstroi o array de arrays para groupRows
      const { clients } = await groupRows(rawRows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      const columns = [
        'Lead Selecionado',
        'Tentativa de Contato',
        'Contato Efetuado',
        'Conversa Iniciada',
        'Reunião Agendada',
        'Enviado Spotter',
        'Perdido',
      ];
      const board = columns.map((col) => ({ id: col, title: col, cards: [] }));

      clients.slice(0, limit).forEach((client) => {
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

      const sheetName = 'sheet1';
      const rowIndex = await findRowIndexById(sheetName, 1, 'Cliente_ID', id);
      if (rowIndex < 0) {
        return res.status(404).json({ error: 'ID não encontrado' });
      }

      const updates = {};
      if (newStatus !== undefined) {
        updates['Status_Kanban'] = newStatus;
      }
      if (newColor !== undefined) {
        updates['Cor_Card'] = newColor;
      }
      updates['Data_Ultima_Movimentacao'] = new Date().toISOString().split('T')[0];

      await updateRowByIndex({ sheetName, rowIndex, updates });

      return res.status(200).json({ status: newStatus, color: newColor });
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      const statusCode = err?.response?.status || err?.code || 500;
      return res.status(statusCode).json({ error: err.message || 'Erro ao atualizar kanban' });
    }
  }

  return res.status(405).end();
}
