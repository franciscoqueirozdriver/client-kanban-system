import { getSheetsClient } from '@/lib/googleSheets.js';

const SHEET_ID = process.env.SPREADSHEET_ID!;
if (!SHEET_ID) {
  throw new Error('SPREADSHEET_ID is not set');
}

export type SheetCell = string | number | boolean | null;
export type SheetRow = SheetCell[];

export const FACTS_HEADERS = [
  "Cliente_ID",
  "Empresa_ID",
  "Nome da Empresa",
  "CNPJ",
  "Perdcomp_Numero",
  "Perdcomp_Formatado",
  "B1",
  "B2",
  "Data_DDMMAA",
  "Data_ISO",
  "Tipo_Codigo",
  "Tipo_Nome",
  "Natureza",
  "Familia",
  "Credito_Codigo",
  "Credito_Descricao",
  "Risco_Nivel",
  "Protocolo",
  "Situacao",
  "Situacao_Detalhamento",
  "Motivo_Normalizado",
  "Solicitante",
  "Fonte",
  "Data_Consulta",
  "URL_Comprovante_HTML",
  "Row_Hash",
  "Inserted_At",
  "Consulta_ID",
  "Version",
  "Deleted_Flag",
];

export const SNAPSHOT_HEADERS = [
  "Cliente_ID",
  "Empresa_ID",
  "Nome da Empresa",
  "CNPJ",
  "Qtd_Total",
  "Qtd_DCOMP",
  "Qtd_REST",
  "Qtd_RESSARC",
  "Risco_Nivel",
  "Risco_Tags_JSON",
  "Por_Natureza_JSON",
  "Por_Credito_JSON",
  "Datas_JSON",
  "Primeira_Data_ISO",
  "Ultima_Data_ISO",
  "Resumo_Ultima_Consulta_JSON_P1",
  "Resumo_Ultima_Consulta_JSON_P2",
  "Card_Schema_Version",
  "Rendered_At_ISO",
  "Fonte",
  "Data_Consulta",
  "URL_Comprovante_HTML",
  "Payload_Bytes",
  "Last_Updated_ISO",
  "Snapshot_Hash",
  "Facts_Count",
  "Consulta_ID",
  "Erro_Ultima_Consulta",
];

async function getValues(range: string) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return res.data.values ?? [];
}

async function setValues(range: string, values: SheetRow[]) {
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function appendValues(range: string, values: SheetRow[]) {
  if (!values.length) return;
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

async function ensureSheetWithHeaders(sheetTitle: string, headers: string[]) {
  const sheets = await getSheetsClient();
  const current = await getValues(`${sheetTitle}!1:1`).catch(() => []);
  const hasHeader = current && current[0] && current[0].length > 0;

  if (!hasHeader) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    } catch (e) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  }
}

function columnLetterFromIndex(idx: number) {
  let s = '';
  while (idx > 0) {
    const m = (idx - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    idx = Math.floor((idx - m) / 26);
  }
  return s;
}

export async function appendPerdecompFacts(rows: SheetRow[]) {
  await ensureSheetWithHeaders('perdecomp_facts', FACTS_HEADERS);
  return appendValues('perdecomp_facts!A1', rows);
}

export async function upsertPerdecompSnapshot(row: SheetRow) {
  await ensureSheetWithHeaders('perdecomp_snapshot', SNAPSHOT_HEADERS);
  const values = await getValues('perdecomp_snapshot!A:A');
  const headerOffset = 1;
  let rowIndex: number | null = null;

  for (let i = headerOffset; i < values.length; i++) {
    const clienteId = values[i]?.[0];
    if (clienteId && clienteId === row[0]) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex) {
    const lastCol = columnLetterFromIndex(SNAPSHOT_HEADERS.length);
    const range = `perdecomp_snapshot!A${rowIndex}:${lastCol}${rowIndex}`;
    await setValues(range, [row]);
  } else {
    await appendValues('perdecomp_snapshot!A1', [row]);
  }
}
