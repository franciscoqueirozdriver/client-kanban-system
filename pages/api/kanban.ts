import { NextApiRequest, NextApiResponse } from 'next';
import { readSheet, updateRows } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import { Sheet1Row } from '@/types/sheets';

// ✅ Protege números de telefone para salvar como texto no Sheets
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}

function collectEmails(row) {
  const emails = [
    row.pessoa_email_work || '',
    row.pessoa_email_home || '',
    row.pessoa_email_other || '',
  ]
    .map((e) => String(e).trim())
    .filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function normalizePhones(row) {
    const phones = new Set();
    if (row.telefone_normalizado) {
        row.telefone_normalizado.split(';').forEach(p => phones.add(p.trim()));
    }
    return Array.from(phones).filter(Boolean);
}


async function groupRows(rows) {
  const map = new Map();

  rows.forEach((row, i) => {
    const clienteId = row.cliente_id;
    if (!clienteId) return;

    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row.organizacao_nome || '',
        opportunities: [],
        contactsMap: new Map(),
        segment: row.organizacao_segmento || '',
        size: row.organizacao_tamanho_da_empresa || '',
        uf: row.uf || '',
        city: row.cidade_estimada || '',
        status: '', // Will be overwritten by the latest row
        dataMov: '', // Will be overwritten by the latest row
        color: '', // Will be overwritten by the latest row
        produto: row.negocio_nome_do_produto || '',
        rows: [],
      });
    }

    // Always update status and color to reflect the latest row for a given ID
    const client = map.get(clienteId);
    const newStatus = (row.status_kanban || '').trim();
    const newColor = row.cor_card || '';
    const newDataMov = row.data_ultima_movimentacao || '';

    if (newStatus) client.status = newStatus;
    if (newColor) client.color = newColor;
    if (newDataMov) client.dataMov = newDataMov;

    client.opportunities.push(row.negocio_titulo || '');
    client.rows.push(i + 2); // Assuming the original data starts from row 2

    const contactName = (row.negocio_pessoa_de_contato || '').trim();
    const allEmails = collectEmails(row);
    const key = `${contactName}|${allEmails}`;

    if (!client.contactsMap.has(key)) {
      const normalized = normalizePhones(row).map(protectPhoneValue);
      client.contactsMap.set(key, {
        name: contactName,
        role: (row.pessoa_cargo || '').trim(),
        email: allEmails,
        phone: protectPhoneValue(row.pessoa_telefone),
        mobile: protectPhoneValue(row.pessoa_celular),
        normalizedPhones: normalized,
        linkedin: (row.pessoa_end_linkedin || '').trim(),
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const dataRows = await readSheet<Sheet1Row>(SHEETS.SHEET1);
      const { clients } = await groupRows(dataRows);

      const limitParam = parseInt(req.query.limit as string ?? '', 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      type KanbanCard = {
        id: string;
        client: any;
      };

      type KanbanColumn = {
        id: string;
        title: string;
        cards: KanbanCard[];
      };

      const columns = [
        'Lead Selecionado',
        'Tentativa de Contato',
        'Contato Efetuado',
        'Conversa Iniciada',
        'Reunião Agendada',
        'Enviado Spotter',
        'Perdido',
      ];
      const board: KanbanColumn[] = columns.map((col) => ({ id: col, title: col, cards: [] }));

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

      const rows = await readSheet<Sheet1Row>(SHEETS.SHEET1);
      const rowToUpdate = rows.find(r => r.cliente_id === id);

      if (!rowToUpdate) {
        return res.status(404).json({ error: 'ID não encontrado' });
      }

      if (newStatus !== undefined) {
        rowToUpdate.status_kanban = newStatus;
      }
      if (newColor !== undefined) {
        rowToUpdate.cor_card = newColor;
      }
      rowToUpdate.data_ultima_movimentacao = new Date().toISOString().split('T')[0];

      await updateRows(SHEETS.SHEET1, [rowToUpdate]);

      return res.status(200).json({ status: newStatus, color: newColor });
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      const statusCode = err?.response?.status || err?.code || 500;
      return res.status(statusCode).json({ error: err.message || 'Erro ao atualizar kanban' });
    }
  }

  return res.status(405).end();
}
