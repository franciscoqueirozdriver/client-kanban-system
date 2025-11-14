/* globals process */
import { getSheetsClient, readSheet } from '../../lib/googleSheets';
import { SHEETS, SHEET1_COLUMNS } from '../../lib/sheets-mapping';

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
    const rows = await readSheet(SHEETS.SHEET1);
    const headers = Object.keys(SHEET1_COLUMNS);
    const colorIdx = headers.indexOf(SHEET1_COLUMNS.cor_card);
    if (colorIdx === -1) {
      return res.status(400).json({ error: 'Coluna cor_card não encontrada' });
    }

    const updates = [];
    const antesDepois = [];

    for (const row of rows) {
      const id = clean(row[SHEET1_COLUMNS.cliente_id]);
      const cor = clean(row[SHEET1_COLUMNS.cor_card]);
      if (!id || !cor) continue;
      if (cor.toLowerCase() === 'grenn') {
        const linha = row._rowNumber;
        const col = colLetter(colorIdx);
        updates.push({
          range: `${SHEETS.SHEET1}!${col}${linha}:${col}${linha}`,
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
