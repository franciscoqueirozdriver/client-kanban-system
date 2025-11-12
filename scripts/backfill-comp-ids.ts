/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */

import { chunk, getSheetData, getSheetsClient, withRetry } from '@/lib/googleSheets.js';

const SNAPSHOT_SHEET = 'perdecomp_snapshot';
const FACTS_SHEET = 'perdecomp_facts';
const CLT_ID_RE = /^CLT-\d{4,}$/;

function onlyDigits(value?: string | null): string {
  return (value ?? '').replace(/\D+/g, '');
}

function toStringValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

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

async function run() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }

  const snapshotData = await getSheetData(SNAPSHOT_SHEET);
  const factsData = await getSheetData(FACTS_SHEET);

  const clienteIdxSnapshot = snapshotData.headers.indexOf('Cliente_ID');
  const cnpjIdxSnapshot = snapshotData.headers.indexOf('CNPJ');
  if (clienteIdxSnapshot === -1 || cnpjIdxSnapshot === -1) {
    throw new Error('Snapshot sheet is missing Cliente_ID or CNPJ headers');
  }

  const clienteIdxFacts = factsData.headers.indexOf('Cliente_ID');
  if (clienteIdxFacts === -1) {
    throw new Error('Facts sheet is missing Cliente_ID header');
  }

  const clienteLetterSnapshot = columnNumberToLetter(clienteIdxSnapshot + 1);
  const clienteLetterFacts = columnNumberToLetter(clienteIdxFacts + 1);

  const compRows = snapshotData.rows.filter((row) =>
    typeof row.Cliente_ID === 'string' && row.Cliente_ID.startsWith('COMP-'),
  );
  if (!compRows.length) {
    console.info('BACKFILL_DONE', { fixedSnap: 0, fixedFacts: 0 });
    return;
  }

  // Build lookup of CNPJ -> existing CLT id
  const cnpjToClt = new Map<string, string>();
  let maxClt = 0;
  for (const row of snapshotData.rows) {
    const id = toStringValue(row.Cliente_ID);
    const match = id.match(/^CLT-(\d{4,})$/);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        maxClt = Math.max(maxClt, value);
      }
    }
    if (CLT_ID_RE.test(id)) {
      const cnpjDigits = onlyDigits(toStringValue(row.CNPJ));
      if (cnpjDigits) {
        cnpjToClt.set(cnpjDigits, id);
      }
    }
  }

  let nextClt = maxClt + 1;
  const sheets = await getSheetsClient();

  let fixedSnap = 0;
  let fixedFacts = 0;

  const updates: Array<{ range: string; values: string[][] }> = [];

  for (const row of compRows) {
    const oldId = toStringValue(row.Cliente_ID);
    const cnpjDigits = onlyDigits(toStringValue(row.CNPJ));

    let newId = (cnpjDigits && cnpjToClt.get(cnpjDigits)) || '';
    if (!newId) {
      newId = `CLT-${String(nextClt).padStart(4, '0')}`;
      nextClt += 1;
      if (cnpjDigits) {
        cnpjToClt.set(cnpjDigits, newId);
      }
    }

    updates.push({
      range: `${SNAPSHOT_SHEET}!${clienteLetterSnapshot}${row._rowNumber}`,
      values: [[newId]],
    });
    fixedSnap += 1;

    const matchingFacts = factsData.rows.filter(
      (fact) => toStringValue(fact.Cliente_ID) === oldId,
    );
    matchingFacts.forEach((fact) => {
      updates.push({
        range: `${FACTS_SHEET}!${clienteLetterFacts}${fact._rowNumber}`,
        values: [[newId]],
      });
    });
    fixedFacts += matchingFacts.length;

    console.info('BACKFILL', {
      from: oldId,
      to: newId,
      snapshot: 1,
      facts: matchingFacts.length,
    });
  }

  if (updates.length) {
    const batches = chunk(updates, 200);
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

  console.info('BACKFILL_DONE', { fixedSnap, fixedFacts });
}

run().catch((error) => {
  console.error('BACKFILL_FAIL', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
