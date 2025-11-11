import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { z } from 'zod';
import LRUCache from 'lru-cache';
import planilhaMapping from '../config/planilha_mapping.json';
import dotenv from 'dotenv';
dotenv.config({ path: './env.local' });


if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.SPREADSHEET_ID) {
  throw new Error('Missing Google Sheets credentials in environment variables');
}

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

const cache = new LRUCache({
  max: 10,
  ttl: 1000 * 60 * 5, // 5 minutes
});

function toSnakeCase(str) {
  if (!str) return '';
  return String(str)
    .replace(/\s+/g, '_')
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .toLowerCase();
}

function normalizeHeaders(headers) {
  return headers.map((header) => planilhaMapping[header] || toSnakeCase(header));
}

function normalizeRow(row, normalizedHeaders) {
  const normalizedRow = {};
  row.forEach((value, i) => {
    normalizedRow[normalizedHeaders[i]] = value;
  });
  return normalizedRow;
}

export async function getSheetData(sheetName) {
  const cacheKey = `sheet_${sheetName}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  const rows = await sheet.getRows();
  const headers = sheet.headerValues;
  const normalizedHeaders = normalizeHeaders(headers);
  const normalizedRows = rows.map((row) => normalizeRow(row._rawData, normalizedHeaders));

  const data = { headers: normalizedHeaders, rows: normalizedRows };
  cache.set(cacheKey, data);
  return data;
}

export async function getSheet(sheetName) {
  const data = await getSheetData(sheetName)
  return {data: {values: [data.headers, ...data.rows.map(row => Object.values(row))]}}
}


export async function getSheetCached(sheetName = 'sheet1') {
    return getSheet(sheetName);
}

export async function appendRow(data, sheetName = 'sheet1') {
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[sheetName];
  await sheet.addRow(data);
}

export async function updateRow(rowIndex, data, sheetName = 'sheet1') {
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[sheetName];
  const rows = await sheet.getRows();
  Object.assign(rows[rowIndex], data);
  await rows[rowIndex].save();
}
