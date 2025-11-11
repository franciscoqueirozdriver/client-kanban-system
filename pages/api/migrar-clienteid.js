import { getSheetsClient, withRetry } from '../../lib/googleSheets';

const SHEETS = ['sheet1', 'layout_importacao_empresas'];

const clean = (v) => (v ?? '').toString().trim();
const colLetter = (n) => { let s=''; while(n>=0){ s=String.fromCharCode((n%26)+65)+s; n=Math.floor(n/26)-1; } return s; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const debug = req.query?.debug === '1';
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const meta = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }));
    const sheetIdByTitle = new Map(meta.data.sheets.map(s => [s.properties.title, s.properties.sheetId]));

    const out = {
      changedSheets: [],
      renamedHeaders: [],
      movedValues: [],
      deletedClientIdColumns: [],
      warnings: [],
      debugDump: {}
    };

    for (const title of SHEETS) {
      const sheetId = sheetIdByTitle.get(title);
      if (!sheetId) { out.warnings.push(`Aba não encontrada: ${title}`); continue; }

      // Header
      const headerResp = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${title}'!1:1`
      }));
      const header = headerResp.data.values?.[0] || [];
      if (!header.length) { out.warnings.push(`Aba vazia: ${title}`); continue; }

      let idxCliente = header.findIndex(h => clean(h) === 'cliente_id');
      let idxClient  = header.findIndex(h => clean(h) === 'client_id');

      if (idxCliente === -1 && idxClient === -1) {
        out.warnings.push(`Nenhuma coluna cliente_id/client_id em ${title}`);
        continue;
      }

      // Apenas client_id -> renomear para cliente_id
      if (idxCliente === -1 && idxClient !== -1) {
        header[idxClient] = 'cliente_id';
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${title}'!1:1`,
          valueInputOption: 'RAW',
          requestBody: { values: [header] }
        });
        out.renamedHeaders.push({ sheet: title, from: 'client_id', to: 'cliente_id' });
        idxCliente = idxClient;
        idxClient = -1; // já renomeado
        out.changedSheets.push(title);
      }

      // Ambas existem -> mover dados e deletar coluna errada
      if (idxCliente !== -1 && idxClient !== -1) {
        const endCol = colLetter(Math.max(idxCliente, idxClient));
        const bodyResp = await withRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId, range: `'${title}'!A2:${endCol}`
        }));
        const rows = bodyResp.data.values || [];
        let moved = 0;

        // Copiar valores client_id -> cliente_id quando cliente_id estiver vazio
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const vCliente = clean(row[idxCliente] ?? '');
          const vClient  = clean(row[idxClient] ?? '');
          if (!vCliente && vClient) {
            row[idxCliente] = vClient; // move
            moved++;
          }
        }
        if (moved > 0) {
          // regravar apenas as colunas até endCol para todas as linhas lidas
          await withRetry(() => sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${title}'!A2:${endCol}`,
            valueInputOption: 'RAW',
            requestBody: { values: rows }
          }));
          out.movedValues.push({ sheet: title, moved });
        }

        // Deletar coluna client_id
        await withRetry(() => sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: idxClient,
                  endIndex: idxClient + 1
                }
              }
            }]
          }
        }));
        out.deletedClientIdColumns.push({ sheet: title, index: idxClient });
        out.changedSheets.push(title);
      }

      if (debug) {
        const finalHeaderResp = await withRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId, range: `'${title}'!1:1`
        }));
        const finalHeader = finalHeaderResp.data.values?.[0] || [];
        const sampleResp = await withRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId, range: `'${title}'!A2:${colLetter(finalHeader.length - 1)}`
        }));
        out.debugDump[title] = {
          header: finalHeader,
          sample: (sampleResp.data.values || []).slice(0, 3)
        };
      }
    }

    return res.status(200).json(out);
  } catch (err) {
    console.error('[migrar-clienteid] ERRO:', err);
    return res.status(500).json({ error: err.message });
  }
}

