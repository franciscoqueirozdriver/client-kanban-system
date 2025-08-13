import { getSheetCached, appendRow, updateRow } from '../../lib/googleSheets';
import { aggregateClientData } from '../../lib/dataUtils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sheet = await getSheetCached();
      const rows = sheet.data.values || [];
      if (rows.length === 0) {
        return res.status(200).json({ clients: [], filters: {} });
      }
      const { clientMap, filters } = aggregateClientData(rows);
      const clients = Array.from(clientMap.values());
      return res.status(200).json({ clients, filters });
    } catch (error) {
      console.error('Erro ao buscar dados da planilha:', error);
      res.status(500).json({ error: 'Erro interno do servidor ao processar a solicitação.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { row, values } = req.body;
      // A lógica de proteção de telefone agora é tratada centralmente em googleSheets.js
      // e não precisa mais ser feita aqui antes de chamar updateRow/appendRow.
      if (row) {
        await updateRow(row, values);
      } else {
        await appendRow(values);
      }
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Erro ao salvar dados na planilha:', error);
      res.status(500).json({ error: 'Erro interno do servidor ao salvar os dados.' });
    }
  }

  return res.status(405).end();
}
