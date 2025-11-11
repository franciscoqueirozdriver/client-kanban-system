import { getSheetData, findRowIndexById, updateRowByIndex } from '../../lib/googleSheets';

function normalizeCard(row) {
  const get = (key, fallback = '') => row[key] || fallback;

  return {
    id: get('cliente_id') || get('Cliente_ID'),
    company: get('nome_da_empresa') || get('Organização - Nome'),
    status: get('status_kanban') || get('Status_Kanban'),
    color: get('cor_card') || get('Cor_Card'),
    // Add other fields as needed
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { rows } = await getSheetData('sheet1');
      const clients = rows.map(normalizeCard);

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

      clients.forEach((client) => {
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
      const { id, status, color } = req.body;

      const sheetName = 'sheet1';
      const rowIndex = await findRowIndexById(sheetName, 1, 'cliente_id', id);
      if (rowIndex < 0) {
        return res.status(404).json({ error: 'ID não encontrado' });
      }

      const updates = {
        status_kanban: status,
        cor_card: color,
        data_ultima_movimentacao: new Date().toISOString().split('T')[0],
      };

      await updateRowByIndex({ sheetName, rowIndex, updates });

      return res.status(200).json({ status, color });
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      return res.status(500).json({ error: 'Erro ao atualizar kanban' });
    }
  }

  return res.status(405).end();
}
