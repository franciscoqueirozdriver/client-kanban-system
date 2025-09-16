import { getSheet, findRowIndexById, updateRowByIndex } from '../../lib/googleSheets';
import { normalizePhones } from '../../lib/report';
import { KANBAN_COLUMNS, normalizeStatus, baseVisibleFilter } from '../../app/lib/kanbanHelpers';

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
    produto: header.indexOf('Negócio - Nome do produto'),
  };

  const map = new Map();

  data
    .map(row => {
      // Adiciona o _rowNumber para referência futura, se necessário
      const obj = {};
      header.forEach((h, i) => {
        if (h) obj[h] = row[i] ?? '';
      });
      return obj;
    })
    .filter(baseVisibleFilter) // <--- Aplica o filtro para remover status vazios
    .forEach((row, i) => {
      const clienteId = row[header[idx.clienteId]];
      if (!clienteId) return;

      if (!map.has(clienteId)) {
        map.set(clienteId, {
          id: clienteId,
          company: row[header[idx.org]] || '',
          opportunities: [],
          contactsMap: new Map(),
          segment: row[header[idx.segmento]] || '',
          size: row[header[idx.tamanho]] || '',
          uf: row[header[idx.uf]] || '',
          city: row[header[idx.cidade]] || '',
          status: '', // Will be overwritten by the latest row
          dataMov: '', // Will be overwritten by the latest row
          color: '', // Will be overwritten by the latest row
          produto: row[header[idx.produto]] || '',
          rows: [],
        });
      }

      // Always update status and color to reflect the latest row for a given ID
      const client = map.get(clienteId);
      const newStatus = normalizeStatus(row[header[idx.status]]); // <--- Normaliza o status
      const newColor = row[header[idx.cor]] || '';
      const newDataMov = row[header[idx.data]] || '';

      if (newStatus) client.status = newStatus;
      if (newColor) client.color = newColor;
      if (newDataMov) client.dataMov = newDataMov;

      client.opportunities.push(row[header[idx.titulo]] || '');
      client.rows.push(i + 2);

      const contactName = (row[header[idx.contato]] || '').trim();
      const allEmails = collectEmails(row, idx);
      const key = `${contactName}|${allEmails}`;

      if (!client.contactsMap.has(key)) {
        const normalized = normalizePhones(row, idx).map(protectPhoneValue);
        client.contactsMap.set(key, {
          name: contactName,
          role: (row[header[idx.cargo]] || '').trim(),
          email: allEmails,
          phone: protectPhoneValue(row[header[idx.tel]]),
          mobile: protectPhoneValue(row[header[idx.cel]]),
          normalizedPhones: normalized,
          linkedin: (row[header[idx.linkedin]] || '').trim(),
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
      const sheet = await getSheet();
      const rows = sheet.data.values || [];
      const { clients } = groupRows(rows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      const board = KANBAN_COLUMNS.map((col) => ({ id: col, title: col, cards: [] }));

      clients.slice(0, limit).forEach((client) => {
        const col = board.find((c) => c.id === client.status);
        if (col) {
          col.cards.push({ id: client.id, client });
        } else {
          // Fallback for any status that might not be in KANBAN_COLUMNS after normalization
          const fallbackCol = board.find(c => c.id === 'Lead Selecionado');
          if (fallbackCol) {
            fallbackCol.cards.push({ id: client.id, client });
          }
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

      const sheetName = 'Sheet1';
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
