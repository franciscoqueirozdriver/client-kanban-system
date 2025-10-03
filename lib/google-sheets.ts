import type { sheets_v4 } from 'googleapis';

import { getSheetsClient } from './googleSheets.js';

export const SHEET_ID = process.env.SPREADSHEET_ID ?? '';

let sheetsPromise: Promise<sheets_v4.Sheets> | null = null;

export async function getSheets(): Promise<sheets_v4.Sheets> {
  if (!SHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  if (!sheetsPromise) {
    sheetsPromise = getSheetsClient();
  }
  return sheetsPromise;
}
