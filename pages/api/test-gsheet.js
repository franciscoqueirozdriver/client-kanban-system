import { getSheetCached } from '../../lib/googleSheets';

export default async function handler(req, res) {
  try {
    const start = Date.now();
    const response = await getSheetCached();
    const rows = response.data.values || [];
    const [header, ...data] = rows;
    const duration = Date.now() - start;
    console.log('TEST_GSHEET_READ', { duration, rows: data.length });
    res.status(200).json({
      header,
      total: data.length,
      preview: data.slice(0, 5),
    });
  } catch (error) {
    console.error('Erro na leitura da planilha:', error.message);
    res.status(500).json({ error: 'Erro ao acessar o Google Sheets' });
  }
}

