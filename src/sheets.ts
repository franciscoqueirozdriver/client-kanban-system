import { google, sheets_v4 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsClientPromise: Promise<sheets_v4.Sheets> | undefined;

export function getSpreadsheetId(): string {
  const spreadsheetId = process.env.SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SHEET_ID environment variable is not defined.');
  }
  return spreadsheetId;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClientPromise) {
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES
    });
    sheetsClientPromise = Promise.resolve(
      google.sheets({
        version: 'v4',
        auth
      })
    );
  }
  return sheetsClientPromise;
}

export async function getSpreadsheet(): Promise<sheets_v4.Schema$Spreadsheet> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.get({
    spreadsheetId
  });
  return response.data;
}

export async function sheetExists(title: string): Promise<boolean> {
  const spreadsheet = await getSpreadsheet();
  return (spreadsheet.sheets ?? []).some(
    (sheet) => sheet.properties?.title === title
  );
}

export async function getSheetId(title: string): Promise<number | undefined> {
  const spreadsheet = await getSpreadsheet();
  const foundSheet = (spreadsheet.sheets ?? []).find(
    (sheet) => sheet.properties?.title === title
  );
  return foundSheet?.properties?.sheetId ?? undefined;
}

export async function createSheet(title: string): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title
            }
          }
        }
      ]
    }
  });
}

export function getHeaderRange(headers: readonly string[]): string {
  const lastColumn = headers.length;
  const lastColumnLetter = toColumnLetter(lastColumn);
  return `A1:${lastColumnLetter}1`;
}

export function getRowRange(headers: readonly string[], rowIndex: number): string {
  const lastColumnLetter = toColumnLetter(headers.length);
  return `A${rowIndex}:${lastColumnLetter}${rowIndex}`;
}

export async function getKeyRowMap(title: string): Promise<Map<string, number>> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A:A`
  });

  const rows = response.data.values ?? [];
  const map = new Map<string, number>();
  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    if (rowIndex === 1) {
      return;
    }
    const key = row[0];
    if (key) {
      map.set(String(key), rowIndex);
    }
  });
  return map;
}

function toColumnLetter(columnNumber: number): string {
  let temp = columnNumber;
  let letter = '';
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}
