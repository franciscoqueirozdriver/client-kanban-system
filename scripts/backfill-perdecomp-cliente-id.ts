import { getSheetData, getSheetsClient, withRetry } from '../lib/googleSheets';
import { SHEETS } from '../lib/sheets-mapping';
import { CLT_ID_RE, resolveClienteId } from '../lib/perdecomp-persist';

const SNAPSHOT_SHEET = SHEETS.PERDECOMP_SNAPSHOT;
const FACTS_SHEET = SHEETS.PERDCOMP_FACTS;

function columnNumberToLetter(columnNumber: number): string {
  let temp: number;
  let letter = '';
  let num = columnNumber;
  while (num > 0) {
    temp = (num - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    num = (num - temp - 1) / 26;
  }
  return letter;
}

async function main() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }

  const sheets = await getSheetsClient();
  const { headers: snapshotHeaders, rows: snapshotRows } = await getSheetData(SNAPSHOT_SHEET);
  const clienteIdx = snapshotHeaders.indexOf('cliente_id');
  if (clienteIdx === -1) {
    throw new Error('cliente_id column not found in perdecomp_snapshot');
  }
  const lastUpdatedIdx = snapshotHeaders.indexOf('last_updated_iso');

  const replacements = new Map<string, string>();
  const nowISO = new Date().toISOString();

  for (const row of snapshotRows) {
    const currentId = String(row.cliente_id || '').trim();
    if (!currentId.startsWith('COMP-')) continue;

    const cnpj = (row.cnpj as string) || null;
    const resolved = await resolveClienteId({ providedClienteId: null, cnpj });
    if (!CLT_ID_RE.test(resolved)) {
      console.warn('BACKFILL_SKIP_INVALID_RESOLUTION', { currentId, cnpj, resolved });
      continue;
    }
    if (resolved === currentId) continue;

    const updates: Array<{ range: string; values: string[][] }> = [];
    const clienteLetter = columnNumberToLetter(clienteIdx + 1);
    updates.push({
      range: `${SNAPSHOT_SHEET}!${clienteLetter}${row._rowNumber}`,
      values: [[resolved]],
    });
    if (lastUpdatedIdx !== -1) {
      const lastLetter = columnNumberToLetter(lastUpdatedIdx + 1);
      updates.push({
        range: `${SNAPSHOT_SHEET}!${lastLetter}${row._rowNumber}`,
        values: [[nowISO]],
      });
    }

    if (updates.length) {
      await withRetry(() =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates,
          },
        }),
      );
    }

    replacements.set(currentId, resolved);
    console.info('BACKFILL_SNAPSHOT_UPDATED', { from: currentId, to: resolved, row: row._rowNumber });
  }

  if (!replacements.size) {
    console.info('BACKFILL_NO_CHANGES');
    return;
  }

  const { headers: factHeaders, rows: factRows } = await getSheetData(FACTS_SHEET);
  const factClienteIdx = factHeaders.indexOf('cliente_id');
  if (factClienteIdx === -1) {
    console.warn('BACKFILL_FACTS_NO_CLIENTE_COLUMN');
    return;
  }

  const factUpdates: Array<{ range: string; values: string[][] }> = [];
  const factLetter = columnNumberToLetter(factClienteIdx + 1);
  for (const row of factRows) {
    const currentId = String(row.cliente_id || '').trim();
    const replacement = replacements.get(currentId);
    if (!replacement) continue;
    factUpdates.push({
      range: `${FACTS_SHEET}!${factLetter}${row._rowNumber}`,
      values: [[replacement]],
    });
  }

  if (factUpdates.length) {
    const batches: Array<typeof factUpdates> = [];
    for (let i = 0; i < factUpdates.length; i += 200) {
      batches.push(factUpdates.slice(i, i + 200));
    }
    for (const batch of batches) {
      await withRetry(() =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: batch,
          },
        }),
      );
    }
  }

  console.info('BACKFILL_FACTS_UPDATED', {
    replacements: replacements.size,
    factRowsUpdated: factUpdates.length,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('BACKFILL_FAILED', error);
    process.exit(1);
  });
}
