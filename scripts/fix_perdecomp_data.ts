import { getSheetData, getSheetsClient } from '../lib/googleSheets';
import {
  normalizeCnpj as canonicalNormalizeCnpj,
  generatePerdcompId,
  isValidClienteIdPattern,
  isValidPerdcompIdPattern,
  isValidCnpjPattern,
  zeroPad,
} from '../lib/normalizers';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify/sync';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

interface ReportEntry {
  Linha: number;
  Campo: string;
  Antes: string;
  Depois: string;
  Ação: string;
}

// Simple hash function for deterministic Perdcomp_ID generation
function simpleHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Lenient CNPJ normalizer for the fixer script
function fixCnpj(raw: any): string {
  if (raw === null || typeof raw === 'undefined') return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length > 14) {
    digits = digits.slice(-14); // Keep last 14 digits as per policy
  }
  return digits.padStart(14, '0');
}

async function main() {
  console.log('Iniciando script de correção retroativa da aba PERDECOMP...');
  const isDryRun = !process.argv.includes('--write');
  console.log(isDryRun ? 'Modo: DRY RUN (nenhuma alteração será salva)' : 'Modo: WRITE (alterações serão salvas na planilha)');

  // 1. Fetch data
  const { headers, rows } = await getSheetData(PERDECOMP_SHEET_NAME);
  if (rows.length === 0) {
    console.log('Nenhuma linha encontrada na aba PERDECOMP. Encerrando.');
    return;
  }
  console.log(`Encontradas ${rows.length} linhas para processar.`);

  const report: ReportEntry[] = [];
  const updates: { range: string; values: any[][] }[] = [];

  // 2. Remap Cliente_IDs
  console.log('Mapeando Cliente_IDs para o formato CLT-XXXX...');
  const clienteIdMap = new Map<string, string>();
  let maxValidId = 0;
  rows.forEach(row => {
    const originalId = row['Cliente_ID'];
    if (originalId && isValidClienteIdPattern(originalId)) {
      const num = parseInt(originalId.slice(4), 10);
      if (num > maxValidId) maxValidId = num;
    }
  });

  const uniqueInvalidIds = new Set(rows.map(r => r['Cliente_ID']).filter(id => id && !isValidClienteIdPattern(id)));
  let nextId = maxValidId + 1;
  for (const oldId of Array.from(uniqueInvalidIds)) {
    clienteIdMap.set(oldId, `CLT-${zeroPad(nextId++)}`);
  }
  console.log(`Mapeados ${clienteIdMap.size} Cliente_IDs inválidos para novos formatos.`);

  // 3. Process each row
  for (const row of rows) {
    const rowNumber = row._rowNumber;
    let newRowData: Record<string, any> = { ...row };

    // --- Normalize Cliente_ID ---
    const originalClienteId = row['Cliente_ID'];
    if (clienteIdMap.has(originalClienteId)) {
      const newClienteId = clienteIdMap.get(originalClienteId)!;
      newRowData['Cliente_ID'] = newClienteId;
      report.push({ Linha: rowNumber, Campo: 'Cliente_ID', Antes: originalClienteId, Depois: newClienteId, Ação: 'REMAP' });
    }

    // --- Normalize Perdcomp_ID ---
    const originalPerdcompId = row['Perdcomp_ID'];
    if (originalPerdcompId && !isValidPerdcompIdPattern(originalPerdcompId)) {
      const seed = simpleHash(JSON.stringify(row));
      const newPerdcompId = generatePerdcompId(new Date(), seed);
      newRowData['Perdcomp_ID'] = newPerdcompId;
      report.push({ Linha: rowNumber, Campo: 'Perdcomp_ID', Antes: originalPerdcompId, Depois: newPerdcompId, Ação: 'REGENERATE' });
    }

    // --- Normalize CNPJ ---
    const originalCnpj = row['CNPJ'];
    const newCnpj = fixCnpj(originalCnpj);
    if (originalCnpj !== newCnpj && isValidCnpjPattern(newCnpj)) {
      newRowData['CNPJ'] = newCnpj;
      report.push({ Linha: rowNumber, Campo: 'CNPJ', Antes: String(originalCnpj), Depois: newCnpj, Ação: 'NORMALIZE' });
    }

    // 4. Collect updates
    headers.forEach((header, index) => {
        if (row[header] !== newRowData[header]) {
            const colLetter = String.fromCharCode(65 + index);
            updates.push({
                range: `${PERDECOMP_SHEET_NAME}!${colLetter}${rowNumber}`,
                values: [[newRowData[header]]],
            });
        }
    });
  }

  // 5. Generate report
  console.log(`Total de correções a serem aplicadas: ${updates.length}`);
  if (report.length > 0) {
    await fs.mkdir('out', { recursive: true });
    const csvString = stringify(report, { header: true });
    await fs.writeFile('out/fix_perdecomp_report.csv', csvString);
    console.log('Relatório de correções gerado em: out/fix_perdecomp_report.csv');
  } else {
    console.log('Nenhuma correção necessária.');
  }

  // 6. Apply updates to the sheet if not in dry run
  if (!isDryRun && updates.length > 0) {
    console.log('Aplicando atualizações na planilha...');
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID!;
    // Batch updates in chunks of 500 to avoid API limits
    const updateChunks: { range: string; values: any[][] }[][] = [];
    for (let i = 0; i < updates.length; i += 500) {
        updateChunks.push(updates.slice(i, i + 500));
    }
    for (const chunk of updateChunks) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'RAW',
                data: chunk,
            },
        });
        console.log(`Lote de ${chunk.length} atualizações aplicado com sucesso.`);
    }
    console.log('Todas as atualizações foram aplicadas.');
  } else if (!isDryRun) {
    console.log('Nenhuma atualização para aplicar.');
  }

  console.log('Script concluído.');
}

main().catch(err => {
  console.error('Erro fatal durante a execução do script:', err);
  process.exit(1);
});