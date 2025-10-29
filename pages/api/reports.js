import { getSheetData, updateRow } from '../../lib/googleSheets';
import { buildReport, mapToRows, markPrintedRows } from '../../lib/report';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const limitParam = parseInt(req.query.limit ?? req.query.maxLeads, 10);
      const onlyNew = req.query.onlyNew === '1';

      const { headers, rows } = await getSheetData('Sheet1');

      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : rows.length;
      console.log('API /reports GET', { query: req.query, limit, onlyNew });
      // ✅ buildReport já agrupa por Cliente_ID agora
      // Evita atualizar telefones durante a geração do relatório
      const { map, filters } = await buildReport({ headers, rows }, { savePhones: false });
      const { rows: reportRows, toMark } = mapToRows(
        map,
        req.query,
        limit,
        onlyNew
      );

      const resposta = {
        filters: {
          segmento: Array.from(filters.segmento),
          porte: Array.from(filters.porte),
          uf: Array.from(filters.uf),
          cidade: Array.from(filters.cidade),
        },
        rows: reportRows,
        total: reportRows.length,
        toMark: Array.from(toMark),
      };

      console.log('API /reports resposta', { total: resposta.total });
      return res.status(200).json(resposta);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      return res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { rowsToMark } = req.body;
      if (!rowsToMark || rowsToMark.length === 0) {
        return res.status(400).json({ error: 'Nenhuma linha para marcar' });
      }

      // ✅ Marca as linhas como "Em Lista"
      await markPrintedRows(updateRow, rowsToMark);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Erro ao marcar linhas:', err);
      return res.status(500).json({ error: 'Erro ao marcar linhas' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
