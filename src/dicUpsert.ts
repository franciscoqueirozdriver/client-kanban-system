import { sheets_v4 } from 'googleapis';
import {
  DIC_CREDITOS_HEADERS,
  DIC_NATUREZAS_HEADERS,
  DIC_TIPOS_HEADERS
} from './perdcompHeaders';
import {
  getKeyRowMap,
  getRowRange,
  getSheetsClient,
  getSpreadsheetId
} from './sheets';

interface TipoInput {
  codigo: string;
  nome: string;
  descricao?: string;
  exemplo?: string;
  fonte?: string;
}

interface NaturezaInput {
  codigoNat: string;
  familia: 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';
  nome: string;
  observacao?: string;
  exemplo?: string;
  fonte?: string;
}

interface CreditoInput {
  codigoCred: string;
  descricao: string;
  exemplo?: string;
  fonte?: string;
}

const SHEET_TIPOS = 'DIC_TIPOS';
const SHEET_NATUREZAS = 'DIC_NATUREZAS';
const SHEET_CREDITOS = 'DIC_CREDITOS';

export async function upsertTipo(input: TipoInput): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const key = `TIPO:${input.codigo}`;
  const rowValues = [
    key,
    '4',
    input.codigo,
    input.nome,
    input.descricao ?? '',
    input.fonte ?? '',
    input.exemplo ?? '',
    new Date().toISOString()
  ];

  await upsertRow({
    sheets,
    spreadsheetId,
    sheetTitle: SHEET_TIPOS,
    headers: DIC_TIPOS_HEADERS,
    key,
    rowValues
  });
}

export async function upsertNatureza(input: NaturezaInput): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const key = `NAT:${input.codigoNat}`;
  const rowValues = [
    key,
    '5',
    input.codigoNat,
    input.familia,
    input.nome,
    input.observacao ?? '',
    input.fonte ?? '',
    input.exemplo ?? '',
    new Date().toISOString()
  ];

  await upsertRow({
    sheets,
    spreadsheetId,
    sheetTitle: SHEET_NATUREZAS,
    headers: DIC_NATUREZAS_HEADERS,
    key,
    rowValues
  });
}

export async function upsertCredito(input: CreditoInput): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const key = `CRED:${input.codigoCred}`;
  const rowValues = [
    key,
    '6',
    input.codigoCred,
    input.descricao,
    input.fonte ?? '',
    input.exemplo ?? '',
    new Date().toISOString()
  ];

  await upsertRow({
    sheets,
    spreadsheetId,
    sheetTitle: SHEET_CREDITOS,
    headers: DIC_CREDITOS_HEADERS,
    key,
    rowValues
  });
}

interface UpsertArgs {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetTitle: string;
  headers: readonly string[];
  key: string;
  rowValues: (string | number)[];
}

async function upsertRow({
  sheets,
  spreadsheetId,
  sheetTitle,
  headers,
  key,
  rowValues
}: UpsertArgs): Promise<void> {
  const keyMap = await getKeyRowMap(sheetTitle);
  const rowIndex = keyMap.get(key);

  if (rowIndex) {
    const range = `${sheetTitle}!${getRowRange(headers, rowIndex)}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowValues]
      }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetTitle,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues]
      }
    });
  }
}
