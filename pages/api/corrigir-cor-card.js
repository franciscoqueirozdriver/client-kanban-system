import { getSheetsClient, getSheetData } from '../../lib/googleSheets';

const SHEET_NAME = 'Sheet1';
const KEY = 'Cliente_ID';
const COLOR_COLUMN = 'Cor_Card';

const clean = (v) => (v ?? '').toString().trim();

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { headers, rows } = await getSheetData(SHEET_NAME);
    const colorIdx = headers.indexOf(COLOR_COLUMN);
    if (colorIdx === -1) {
      return res.status(400).json({ error: 'Coluna Cor_Card não encontrada' });
    }

    const updates = [];
    const antesDepois = [];

    for (const row of rows) {
      const id = clean(row[KEY]);
      const cor = clean(row[COLOR_COLUMN]);
      if (!id || !cor) continue;
      if (cor.toLowerCase() === 'grenn') {
        const linha = row._rowNumber;
        const col = colLetter(colorIdx);
        updates.push({
          range: `${SHEET_NAME}!${col}${linha}:${col}${linha}`,
          values: [['green']],
        });
        antesDepois.push({ linha, antes: cor, depois: 'green' });
      }
    }

    if (updates.length > 0) {
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    const linhas = antesDepois.map((a) => a.linha);
    return res.status(200).json({
      corrigidos: antesDepois.length,
      linhas,
      antesDepois,
    });
  } catch (err) {
    console.error('[corrigir-cor-card] ERRO:', err);
    return res.status(500).json({ error: err.message });
  }
}
