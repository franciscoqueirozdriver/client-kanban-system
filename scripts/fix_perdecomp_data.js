import { getSheetsClient, getSheetData } from '../lib/googleSheets.js';
import {
  normalizeCnpj,
  generatePerdcompId,
  isValidPerdcompIdPattern,
  isValidClienteIdPattern,
  zeroPad,
} from '../lib/normalizers.js';
import fs from 'fs';
import path from 'path';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';
const BATCH_SIZE = 400; // Batch size for writing to Google Sheets API

function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

async function fixPerdecompData() {
  console.log('Starting PERDECOMP data normalization script...');

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set.');
  }

  // 1. Fetch all data from the sheet
  const { headers, rows } = await getSheetData(PERDECOMP_SHEET_NAME);
  if (rows.length === 0) {
    console.log('No data found in PERDECOMP sheet. Exiting.');
    return;
  }
  console.log(`Found ${rows.length} rows to process.`);

  const report = [];
  const batchUpdateData = [];

  // 2. Remap Cliente_ID
  console.log('Normalizing Cliente_ID...');
  const clienteIdMap = new Map();
  let maxValidClientIdNum = 0;

  // First, find the highest existing valid ID number
  rows.forEach(row => {
    const clienteId = row.Cliente_ID;
    if (isValidClienteIdPattern(clienteId)) {
      const num = parseInt(clienteId.split('-')[1], 10);
      if (num > maxValidClientIdNum) {
        maxValidClientIdNum = num;
      }
    }
  });

  let nextClientIdNum = maxValidClientIdNum + 1;

  // Create a mapping for all invalid IDs to new, unique, incremental IDs
  rows.forEach(row => {
    const originalId = row.Cliente_ID;
    if (originalId && !isValidClienteIdPattern(originalId) && !clienteIdMap.has(originalId)) {
      const newId = `CLT-${zeroPad(nextClientIdNum++, 4)}`;
      clienteIdMap.set(originalId, newId);
      console.log(`Mapping invalid Cliente_ID: '${originalId}' -> '${newId}'`);
    }
  });

  // 3. Process each row for all normalizations
  console.log('Normalizing Perdcomp_ID and CNPJ for each row...');
  const clienteIdColIdx = headers.indexOf('Cliente_ID');
  const perdcompIdColIdx = headers.indexOf('Perdcomp_ID');
  const cnpjColIdx = headers.indexOf('CNPJ');

  for (const row of rows) {
    const rowNumber = row._rowNumber;

    // Normalize Cliente_ID
    const originalClienteId = row.Cliente_ID;
    if (clienteIdMap.has(originalClienteId)) {
      const newClienteId = clienteIdMap.get(originalClienteId);
      batchUpdateData.push({
        range: `${PERDECOMP_SHEET_NAME}!${columnToLetter(clienteIdColIdx + 1)}${rowNumber}`,
        values: [[newClienteId]],
      });
      report.push({
        Linha: rowNumber,
        Campo: 'Cliente_ID',
        Antes: originalClienteId,
        Depois: newClienteId,
        Ação: 'Remapeado',
      });
    }

    // Normalize Perdcomp_ID
    const originalPerdcompId = row.Perdcomp_ID;
    if (originalPerdcompId && !isValidPerdcompIdPattern(originalPerdcompId)) {
      const newPerdcompId = generatePerdcompId();
      batchUpdateData.push({
        range: `${PERDECOMP_SHEET_NAME}!${columnToLetter(perdcompIdColIdx + 1)}${rowNumber}`,
        values: [[newPerdcompId]],
      });
      report.push({
        Linha: rowNumber,
        Campo: 'Perdcomp_ID',
        Antes: originalPerdcompId,
        Depois: newPerdcompId,
        Ação: 'Regenerado',
      });
    }

    // Normalize CNPJ
    const originalCnpj = row.CNPJ;
    const normalizedCnpj = normalizeCnpj(originalCnpj);
    if (originalCnpj !== normalizedCnpj) {
      batchUpdateData.push({
        range: `${PERDECOMP_SHEET_NAME}!${columnToLetter(cnpjColIdx + 1)}${rowNumber}`,
        values: [[normalizedCnpj]],
      });
      report.push({
        Linha: rowNumber,
        Campo: 'CNPJ',
        Antes: originalCnpj,
        Depois: normalizedCnpj,
        Ação: 'Normalizado',
      });
    }
  }

  // 4. Write changes to the sheet in batches
  if (batchUpdateData.length > 0) {
    console.log(`Found ${batchUpdateData.length} cells to update. Writing to sheet in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < batchUpdateData.length; i += BATCH_SIZE) {
      const batch = batchUpdateData.slice(i, i + BATCH_SIZE);
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: batch,
          },
        });
        console.log(`Processed batch ${i / BATCH_SIZE + 1}...`);
      } catch (error) {
        console.error('Error updating sheet:', error.message);
        // Stop on error to avoid partial writes
        return;
      }
    }
    console.log('All updates have been written to the sheet.');
  } else {
    console.log('No data needed fixing.');
  }

  // 5. Generate CSV report
  if (report.length > 0) {
    const outDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    const reportPath = path.join(outDir, 'fix_perdecomp_report.csv');
    const csvHeader = 'Linha,Campo,Antes,Depois,Ação\n';
    const csvBody = report.map(r => `${r.Linha},${r.Campo},"${r.Antes}","${r.Depois}",${r.Ação}`).join('\n');
    fs.writeFileSync(reportPath, csvHeader + csvBody);
    console.log(`Normalization complete. Report generated at: ${reportPath}`);
  } else {
    console.log('Normalization complete. No report generated as no changes were made.');
  }
}

fixPerdecompData().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});