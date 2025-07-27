import { getSheet } from '../../lib/googleSheets';

export default async function handler(req, res) {
  try {
    const response = await getSheet();
    const rows = response.data.values || [];
    const [header, ...data] = rows;

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

