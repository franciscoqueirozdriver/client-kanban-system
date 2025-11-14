/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */

import { chunk, getSheetData, getSheetsClient, withRetry } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import {
  derivePorCreditoFromFacts,
  deriveRiskFromFacts,
} from '@/lib/perdecomp-persist';

const { PERDECOMP_SNAPSHOT: SHEET_SNAPSHOT, PERDCOMP_FACTS: SHEET_FACTS } = SHEETS;

const RISCO_NIVEL_HEADER = 'Risco_Nivel';
const RISCO_TAGS_HEADER = 'Risco_Tags_JSON';
const POR_CREDITO_HEADER = 'Por_Credito_JSON';

function toStringValue(value: unknown): string {
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

function normalizeRow(row: Record<string, any>) {
  const normalized: Record<string, string> = {};
  Object.entries(row ?? {}).forEach(([key, value]) => {
    if (key === '_rowNumber') return;
    normalized[key] = toStringValue(value);
  });
  return normalized;
}

function parseJSON(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
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

  const snapshotData = await getSheetData(SHEET_SNAPSHOT);
  const factsData = await getSheetData(SHEET_FACTS);

  const clienteIdx = snapshotData.headers.indexOf('cliente_id');
  const riscoIdx = snapshotData.headers.indexOf(RISCO_NIVEL_HEADER);
  const riscoTagsIdx = snapshotData.headers.indexOf(RISCO_TAGS_HEADER);
  const porCreditoIdx = snapshotData.headers.indexOf(POR_CREDITO_HEADER);

  if (clienteIdx === -1 || riscoIdx === -1 || riscoTagsIdx === -1 || porCreditoIdx === -1) {
    throw new Error('Snapshot sheet is missing required headers');
  }

  const factsByCliente = new Map<string, Record<string, string>[]>();
  for (const fact of factsData.rows ?? []) {
    const normalized = normalizeRow(fact);
    const clienteId = normalized.cliente_id;
    if (!clienteId) continue;
    const bucket = factsByCliente.get(clienteId) ?? [];
    bucket.push(normalized);
    factsByCliente.set(clienteId, bucket);
  }

  const sheets = await getSheetsClient();
  const updates: Array<{ range: string; values: string[][] }> = [];

  for (const row of snapshotData.rows ?? []) {
    const clienteId = toStringValue(row.cliente_id);
    if (!clienteId) continue;
    const riskNivel = toStringValue(row[RISCO_NIVEL_HEADER]);
    const riskTagsRaw = toStringValue(row[RISCO_TAGS_HEADER]);
    const riskTagsParsed = parseJSON(riskTagsRaw);
    const porCreditoRaw = toStringValue(row[POR_CREDITO_HEADER]);
    const porCreditoParsed = parseJSON(porCreditoRaw);

    const needsRiskNivel = !riskNivel;
    const needsRiskTags = !Array.isArray(riskTagsParsed) || riskTagsParsed.length === 0;
    const needsPorCredito = !Array.isArray(porCreditoParsed) || porCreditoParsed.length === 0;

    if (!needsRiskNivel && !needsRiskTags && !needsPorCredito) continue;

    const facts = factsByCliente.get(clienteId) ?? [];
    const derivedRisk = deriveRiskFromFacts(facts);
    const derivedCredito = derivePorCreditoFromFacts(facts);

    if (needsRiskNivel) {
      updates.push({
        range: `${SHEET_SNAPSHOT}!${columnNumberToLetter(riscoIdx + 1)}${row._rowNumber}`,
        values: [[derivedRisk.nivel ?? '']],
      });
    }

    if (needsRiskTags) {
      updates.push({
        range: `${SHEET_SNAPSHOT}!${columnNumberToLetter(riscoTagsIdx + 1)}${row._rowNumber}`,
        values: [[JSON.stringify(derivedRisk.tags ?? [])]],
      });
    }

    if (needsPorCredito) {
      updates.push({
        range: `${SHEET_SNAPSHOT}!${columnNumberToLetter(porCreditoIdx + 1)}${row._rowNumber}`,
        values: [[JSON.stringify(derivedCredito)]],
      });
    }

    console.info('BACKFILL_RICH_SNAPSHOT', {
      clienteId,
      updatedRisk: needsRiskNivel || needsRiskTags,
      updatedCredito: needsPorCredito,
    });
  }

  if (!updates.length) {
    console.info('BACKFILL_RICH_SNAPSHOT_DONE', { updates: 0 });
    return;
  }

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

  console.info('BACKFILL_RICH_SNAPSHOT_DONE', { updates: updates.length });
}

run().catch((error) => {
  console.error('BACKFILL_RICH_SNAPSHOT_FAIL', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
