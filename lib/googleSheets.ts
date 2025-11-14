import { google, sheets_v4 } from 'googleapis';
import https from 'https';

import {
  SHEETS,
  SheetName,
  SHEET1_COLUMNS,
  LEADS_EXACT_SPOTTER_COLUMNS,
  LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS,
  PERDECOMP_COLUMNS,
  PERDCOMP_FACTS_COLUMNS,
  PERDECOMP_SNAPSHOT_COLUMNS,
  USUARIOS_COLUMNS,
  PERMISSOES_COLUMNS,
} from '@/lib/sheets-mapping';
import { BaseRow, Sheet1Row } from '@/types/sheets';
import { normalizePayloadToSnakeCase } from './sheets/generalMapping';
import { mapSheetRowToSnakeCase } from './sheets/snakeCase';

// --- Cache & Auth ---

type CacheEntry = {
  time: number;
  data: { headers: string[]; rows: BaseRow[] };
};

const readCache = new Map<string, CacheEntry>();
let sheetsClientPromise: Promise<sheets_v4.Sheets>;

/**
 * Returns a singleton Google Sheets client with keep-alive enabled.
 */
async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

      if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        const msg = 'GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is not set.';
        console.error(msg);
        throw new Error(msg);
      }

      const auth = new google.auth.JWT({
        email: GOOGLE_CLIENT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      google.options({ auth });
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return sheetsClientPromise;
}

/**
 * Retry helper for Google API calls. Retries on transient errors with
 * exponential backoff and jitter.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < tries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as any)?.code || (err as any)?.response?.status || 0;
      const transient = [429, 500, 502, 503, 504];
      if (!transient.includes(status) || attempt === tries - 1) {
        throw err;
      }
      const delay = Math.pow(2, attempt) * 500 + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// --- Generic Sheet Interaction ---

/**
 * Reads data from a sheet, returning headers and structured row objects.
 * This is the base function for reading data and includes caching.
 * @template T The expected row type, extending BaseRow.
 * @param sheetName The name of the sheet from the SHEETS object.
 * @param range The cell range to read (e.g., 'A:ZZ').
 * @param spreadsheetId The ID of the Google Spreadsheet.
 * @returns A promise resolving to an object with headers and typed rows.
 */
export async function getSheetData<T extends BaseRow>(
  sheetName: SheetName,
  range = 'A:ZZ',
  spreadsheetId = process.env.SPREADSHEET_ID
): Promise<{ headers: string[]; rows: T[] }> {
  const key = `sheetData:${sheetName}:${range}`;
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.time < 10000) {
    return cached.data as { headers: string[]; rows: T[] };
  }

  const sheets = await getSheetsClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    })
  );
  const values = res.data.values || [];
  if (values.length === 0) return { headers: [], rows: [] };

  const rawHeaders = values[0];
  const headers = rawHeaders.map((h) => (h || '').toString().trim());

  let columns;
  switch (sheetName) {
    case SHEETS.SHEET1:
      columns = SHEET1_COLUMNS;
      break;
    case SHEETS.LEADS_EXACT_SPOTTER:
      columns = LEADS_EXACT_SPOTTER_COLUMNS;
      break;
    case SHEETS.LAYOUT_IMPORTACAO_EMPRESAS:
        columns = LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS;
        break;
    case SHEETS.PERDECOMP:
      columns = PERDECOMP_COLUMNS;
      break;
    case SHEETS.PERDCOMP_FACTS:
      columns = PERDCOMP_FACTS_COLUMNS;
      break;
    case SHEETS.PERDECOMP_SNAPSHOT:
      columns = PERDECOMP_SNAPSHOT_COLUMNS;
      break;
    case SHEETS.USUARIOS:
      columns = USUARIOS_COLUMNS;
      break;
    case SHEETS.PERMISSOES:
      columns = PERMISSOES_COLUMNS;
      break;
    default:
      // For sheets without a specific mapping, we'll just return the raw data
      // This maintains backward compatibility.
      const rawData = values.slice(1).map((row, idx) => {
        const obj: BaseRow = { _rowNumber: idx + 2 };
        headers.forEach((h, i) => {
          if (h) obj[h] = row[i] ?? '';
        });
        return obj as T;
      });
      const rawResult = { headers, rows: rawData };
      readCache.set(key, { time: Date.now(), data: rawResult });
      return rawResult;
  }

  const data = values.slice(1).map((row, idx) => {
    const rawRow: Record<string, string | number | undefined> = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      if (h) rawRow[h] = row[i] ?? '';
    });
    return mapSheetRowToSnakeCase<T>(rawRow, headers, columns);
  });

  const result = { headers, rows: data };
  readCache.set(key, { time: Date.now(), data: result });
  return result;
}

/**
 * Reads data from a sheet and returns an array of typed row objects.
 * @template T The expected row type, extending BaseRow.
 * @param sheetName The name of the sheet from the SHEETS object.
 * @returns A promise resolving to an array of typed rows.
 */
export async function readSheet<T extends BaseRow>(sheetName: SheetName): Promise<T[]> {
  const { rows } = await getSheetData<T>(sheetName);
  return rows;
}

/**
 * Appends a new row to the specified sheet.
 * @template T The type of the row object being added.
 * @param sheetName The name of the sheet from the SHEETS object.
 * @param row The row object to append. The keys should match the sheet headers.
 * @returns A promise that resolves when the operation is complete.
 */
export async function appendRow<T extends object>(sheetName: SheetName, row: T): Promise<void>;
/**
 * (Legacy) Appends a new row to the 'Sheet1' tab.
 * @deprecated Use `appendRow(SHEETS.SHEET1, data)` instead.
 */
export async function appendRow(data: Partial<Sheet1Row>): Promise<void>;
export async function appendRow<T extends object>(
  sheetNameOrData: SheetName | Partial<Sheet1Row>,
  rowData?: T
): Promise<void> {
  // Handle legacy overload: appendRow(data) for Sheet1
  if (typeof sheetNameOrData !== 'string') {
    const columnOrder = Object.keys(require('@/lib/sheets-mapping').SHEET1_COLUMNS);
    const row = columnOrder.map((header) => (sheetNameOrData as any)[header] || '');
    await appendSheetData(SHEETS.SHEET1, [row]);
    return;
  }

  // Handle new signature: appendRow(sheetName, row)
  const sheetName = sheetNameOrData as SheetName;
  const row = rowData!;

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const sheets = await getSheetsClient();

  const { headers } = await getSheetData(sheetName, 'A1:ZZ1');

  const values = [
    headers.map(header => {
      return (row as any)[header] !== undefined ? (row as any)[header] : '';
    })
  ];

  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })
  );
}

/**
 * Updates existing rows in a sheet. (Placeholder for Module 0)
 * @template T The type of the row objects being updated.
 * @param sheetName The name of the sheet from the SHEETS object.
 * @param rows An array of row objects to update. Must include `_rowNumber`.
 * @returns A promise that resolves when the operation is complete.
 */
export async function updateRows<T extends BaseRow>(sheetName: SheetName, rows: T[]): Promise<void> {
  if (!rows.length) return;

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not set');

  const sheets = await getSheetsClient();
  const { headers } = await getSheetData<T>(sheetName, 'A1:ZZ1');
  if (!headers.length) throw new Error(`Sheet ${sheetName} not found or is empty.`);

  const data: sheets_v4.Schema$ValueRange[] = rows.map(row => {
    const values = headers.map(header => (row as any)[header] ?? '');
    const range = `${sheetName}!A${row._rowNumber}:${columnNumberToLetter(headers.length)}${row._rowNumber}`;
    return { range, values: [values] };
  });

  const batches = chunk(data, 100); // Process in batches of 100 to avoid API limits
  for (const batch of batches) {
    await withRetry(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: batch },
      })
    );
  }
}


// --- Utility and Legacy Functions ---
// (These functions are kept for backward compatibility but should be phased out)

export async function findRowIndexById(sheetName: SheetName, headersRow: number, idColumnName: string, idValue: string | number): Promise<number> {
  if (!process.env.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const normalizedId = String(idValue || '').trim();
  const { headers, rows } = await getSheetData(sheetName, `A${headersRow}:ZZ`);
  const idIdx = headers.indexOf(idColumnName);
  if (idIdx === -1) return -1;
  for (const row of rows) {
    const cell = String((row as any)[idColumnName] || '').trim();
    if (cell === normalizedId) {
      return row._rowNumber;
    }
  }
  return -1;
}

interface UpdateRowPayload {
  sheetName: SheetName;
  rowIndex: number;
  updates: Record<string, any>;
}

export async function updateRowByIndex({ sheetName, rowIndex, updates }: UpdateRowPayload): Promise<void> {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not set');

  const sheets = await getSheetsClient();
  const { headers, rows } = await getSheetData(sheetName);
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => (headerMap[h] = i));

  const currentRow = rows.find((r) => r._rowNumber === rowIndex) || {};
  const data: sheets_v4.Schema$ValueRange[] = [];

  Object.entries(updates || {}).forEach(([col, value]) => {
    const idx = headerMap[col];
    if (idx === undefined) return;
    const colLetter = columnNumberToLetter(idx + 1);
    const range = `${sheetName}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
    data.push({ range, values: [[value]] });
  });

  if (!data.length) return;

  await withRetry(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    })
  );
}

export async function _findRowNumberBycliente_id(sheetName: SheetName, cliente_id: string): Promise<number> {
    const rows = await readSheet(sheetName);
    const row = rows.find(r => r.cliente_id === cliente_id);
    return row ? row._rowNumber : -1;
}

function normalizeText(str: string | null | undefined): string {
    return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCnpj(cnpj: string | null | undefined): string {
    return (cnpj || '').toString().replace(/\D/g, '');
}

function columnNumberToLetter(columnNumber: number): string {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

// --- Data Transformation Helpers ---

function normalizeUF(uf: string | null | undefined) {
  if (!uf) return '';
  const map: Record<string, string> = { AC:'AC',AL:'AL',AP:'AP',AM:'AM',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MT:'MT',MS:'MS',MG:'MG',PA:'PA',PB:'PB',PR:'PR',PE:'PE',PI:'PI',RJ:'RJ',RN:'RN',RS:'RS',RO:'RO',RR:'RR',SC:'SC',SP:'SP',SE:'SE',TO:'TO',ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA:'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO' };
  const cleaned = normalizeText(uf).toUpperCase();
  return map[cleaned] || '';
}

function normalizePhoneNumber(phone = '', ddi = '') {
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    const ddiDigits = ddi.replace(/\D/g, '');

    if (ddiDigits && !digits.startsWith(ddiDigits)) {
        digits = `${ddiDigits}${digits}`;
    }
    if (!digits.startsWith('+')) {
        digits = `+${digits}`;
    }
    return digits;
}

function distributeContactPhones(phonesString = '') {
    const phones = phonesString.split(';').map(p => p.trim()).filter(Boolean);
    return {
        Work: phones[0] || '',
        Mobile: phones[1] || '',
        Home: phones[2] || '',
        Other: phones[3] || '',
    };
}

function isValidEmail(email = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// --- Row Builders for Each Sheet Layout ---
function buildLeadsExactSpotterRow(payload: any) {
    const { empresa = {}, contato = {}, comercial = {} } = payload;
    const columnOrder = Object.keys(require('@/lib/sheets-mapping').LEADS_EXACT_SPOTTER_COLUMNS);

    const row = columnOrder.map(col => {
        switch(col) {
            case 'cliente_id': return payload.cliente_id;
            case 'nome_do_lead': return empresa.nome_da_empresa;
            case 'origem': return comercial.origem;
            case 'sub_origem': return comercial.sub_origem;
            case 'mercado': return comercial.mercado;
            case 'produto': return comercial.produto;
            case 'site': return empresa.site_empresa;
            case 'pais': return empresa.pais_empresa;
            case 'estado': return empresa.estado_empresa;
            case 'cidade': return empresa.cidade_empresa;
            case 'logradouro': return empresa.logradouro_empresa;
            case 'numero': return empresa.numero_empresa;
            case 'bairro': return empresa.bairro_empresa;
            case 'complemento': return empresa.complemento_empresa;
            case 'cep': return empresa.cep_empresa;
            case 'ddi': return empresa.ddi_empresa;
            case 'telefones': return empresa.telefones_empresa;
            case 'observacao': return empresa.observacao_empresa;
            case 'cpf_cnpj': return normalizeCnpj(empresa.cnpj_empresa);
            case 'nome_contato': return contato.nome_contato;
            case 'email_contato': return contato.email_contato;
            case 'cargo_contato': return contato.cargo_contato;
            case 'ddi_contato': return contato.ddi_contato;
            case 'telefones_contato': return contato.telefones_contato;
            case 'tipo_do_serv_comunicacao': return comercial.tipo_do_serv_comunicacao;
            case 'id_do_serv_comunicacao': return comercial.id_do_serv_comunicacao;
            case 'area': return comercial.area;
            case 'nome_da_empresa': return empresa.nome_da_empresa;
            case 'etapa': return comercial.etapa;
            case 'funil': return comercial.funil;
            default: return '';
        }
    });
    return row;
}

function buildLayoutImportacaoRow(payload: any) {
    const { empresa = {} } = payload;
    const columnOrder = Object.keys(require('@/lib/sheets-mapping').LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS);

    return columnOrder.map(col => {
        switch(col) {
            case 'cliente_id': return payload.cliente_id;
            case 'nome_da_empresa': return empresa.nome_da_empresa;
            case 'site_empresa': return empresa.site_empresa;
            case 'pais_empresa': return empresa.pais_empresa;
            case 'estado_empresa': return empresa.estado_empresa;
            case 'cidade_empresa': return empresa.cidade_empresa;
            case 'logradouro_empresa': return empresa.logradouro_empresa;
            case 'numero_empresa': return empresa.numero_empresa;
            case 'bairro_empresa': return empresa.bairro_empresa;
            case 'complemento_empresa': return empresa.complemento_empresa;
            case 'cep_empresa': return empresa.cep_empresa;
            case 'cnpj_empresa': return normalizeCnpj(empresa.cnpj_empresa);
            case 'ddi_empresa': return empresa.ddi_empresa;
            case 'telefones_empresa': return empresa.telefones_empresa;
            case 'observacao_empresa': return empresa.observacao_empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload: any) {
    const { empresa = {}, contato = {}, comercial = {} } = payload;
    const contactPhones = distributeContactPhones(contato.telefones_contato);
    const columnOrder = Object.keys(require('@/lib/sheets-mapping').SHEET1_COLUMNS);

    const rowData: Record<string, any> = {
        'cliente_id': payload.cliente_id,
        'negocio_titulo': empresa.nome_da_empresa,
        'negocio_organizacao': empresa.nome_da_empresa,
        'organizacao_nome': empresa.nome_da_empresa,
        'negocio_pessoa_de_contato': contato.nome_contato,
        'pessoa_cargo': contato.cargo_contato,
        'pessoa_email_work': isValidEmail(contato.email_contato) ? contato.email_contato : '',
        'pessoa_phone_work': normalizePhoneNumber(contactPhones.Work, contato.ddi_contato),
        'pessoa_phone_home': normalizePhoneNumber(contactPhones.Home, contato.ddi_contato),
        'pessoa_phone_mobile': normalizePhoneNumber(contactPhones.Mobile, contato.ddi_contato),
        'pessoa_phone_other': normalizePhoneNumber(contactPhones.Other, contato.ddi_contato),
        'pessoa_telefone': contato.telefones_contato,
        'organizacao_segmento': comercial.mercado,
        'negocio_nome_do_produto': comercial.produto,
        'uf': normalizeUF(empresa.estado_empresa),
        'cidade_estimada': empresa.cidade_empresa,
        'telefone_normalizado': normalizePhoneNumber((empresa.telefones_empresa || '').split(';')[0], empresa.ddi_empresa),
        'negocio_origem': comercial.origem,
        'negocio_canal_de_origem': comercial.origem,
        'negocio_fonte_do_lead': comercial.sub_origem,
        'negocio_funil': comercial.funil || 'Padrão',
        'negocio_etapa': comercial.etapa,
        'negocio_data_de_criacao_do_negocio': new Date().toISOString(),
        'negocio_data_atualizada': new Date().toISOString(),
    };

    return columnOrder.map(col => rowData[col] || '');
}


export async function getNextcliente_id(): Promise<string> {
  readCache.delete(`sheetData:${SHEETS.LEADS_EXACT_SPOTTER}`);
  const { rows } = await getSheetData(SHEETS.LEADS_EXACT_SPOTTER);
  let maxId = 0;
  for (const row of rows) {
    const cliente_id = (row as any)['cliente_id'];
    if (cliente_id && typeof cliente_id === 'string') {
      if (cliente_id.startsWith('CLI-') || cliente_id.startsWith('CLT-')) {
        const num = parseInt(cliente_id.substring(4), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    }
  }
  return `CLT-${maxId + 1}`;
}

const SHEETS_TO_SEARCH: SheetName[] = [SHEETS.LEADS_EXACT_SPOTTER, SHEETS.LAYOUT_IMPORTACAO_EMPRESAS, SHEETS.SHEET1];

export async function findByCnpj(cnpj: string): Promise<BaseRow | null> {
  const normalizedCnpjToFind = normalizeCnpj(cnpj);
  if (!normalizedCnpjToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowCnpj = (row as any)['cnpj_empresa'] || (row as any)['cpf_cnpj'];
      if (normalizeCnpj(rowCnpj) === normalizedCnpjToFind) {
        return { ...row, _sheetName: sheetName };
      }
    }
  }
  return null;
}

export async function findByName(name: string): Promise<BaseRow | null> {
  const normalizedNameToFind = normalizeText(name);
  if (!normalizedNameToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowName = (row as any).nome_da_empresa || (row as any).nome_do_lead;
      if (normalizeText(rowName) === normalizedNameToFind) {
        const rowCnpj = normalizeCnpj((row as any).cnpj_empresa || (row as any).cpf_cnpj);
        if (!rowCnpj) {
          // Return the full row data for pre-filling the form
          return row;
        }
      }
    }
  }
  return null;
}

export async function appendToSheets(rawPayload: any): Promise<void> {
    const payload = normalizePayloadToSnakeCase(rawPayload);
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetProcessOrder = [
        { name: SHEETS.LEADS_EXACT_SPOTTER, builder: buildLeadsExactSpotterRow },
        { name: SHEETS.LAYOUT_IMPORTACAO_EMPRESAS, builder: buildLayoutImportacaoRow },
        { name: SHEETS.SHEET1, builder: buildSheet1Row },
    ];

    for (const sheet of sheetProcessOrder) {
        const rowData = sheet.builder(payload);
        readCache.delete(`sheetData:${sheet.name}`);
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: sheet.name,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowData] },
        });
    }
}

export { getSheetsClient };

export async function appendSheetData(sheetName: SheetName, rowsToAppend: any[][]): Promise<void> {
  if (!sheetName || !rowsToAppend || rowsToAppend.length === 0) {
    throw new Error('sheetName and rowsToAppend are required.');
  }
  const sheets = await getSheetsClient();
  const batches = chunk(rowsToAppend, 500);
  for (const batch of batches) {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: batch },
      })
    );
  }
}

export async function appendHistoryRow(data: any): Promise<void> {
    const { headers } = await getSheetData(SHEETS.HISTORICO_INTERACOES);
    const row = headers.map(header => data[header] || '');
    return appendSheetData(SHEETS.HISTORICO_INTERACOES, [row]);
}

export async function updateInSheets(rawPayload: any, cliente_id: string): Promise<void> {
    const payload = normalizePayloadToSnakeCase(rawPayload);
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders: Record<SheetName, (p: any) => any[]> = {
        [SHEETS.LEADS_EXACT_SPOTTER]: buildLeadsExactSpotterRow,
        [SHEETS.LAYOUT_IMPORTACAO_EMPRESAS]: buildLayoutImportacaoRow,
        [SHEETS.SHEET1]: buildSheet1Row,
        // Add other sheets here as needed, or handle dynamically
    } as any;


    for (const sheetName of [SHEETS.LEADS_EXACT_SPOTTER, SHEETS.LAYOUT_IMPORTACAO_EMPRESAS, SHEETS.SHEET1] as SheetName[]) {
        readCache.delete(`sheetData:${sheetName}`);
        const rowNumber = await _findRowNumberBycliente_id(sheetName, cliente_id);
        if (rowNumber === -1) continue;

        const rowValues = sheetBuilders[sheetName](payload);
        const rangeEndColumn = columnNumberToLetter(rowValues.length);
        const range = `${sheetName}!A${rowNumber}:${rangeEndColumn}${rowNumber}`;

        await withRetry(() =>
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowValues] },
            })
        );
    }
}


// --- Legacy Functions for Backward Compatibility ---

/** @deprecated */
async function _getRawSheet(sheetName: SheetName = SHEETS.SHEET1) {
    const sheets = await getSheetsClient();
    return withRetry(() =>
        sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: sheetName,
        })
    );
}

/** @deprecated Use `readSheet` instead. */
export async function getSheet(sheetName: SheetName = SHEETS.SHEET1) {
    return _getRawSheet(sheetName);
}

/** @deprecated Use `readSheet` instead. */
export async function getSheetCached(sheetName: SheetName = SHEETS.SHEET1) {
    const key = `sheet_raw:${sheetName}`;
    const cached = readCache.get(key);
    if (cached && (Date.now() - cached.time < 10000)) {
        return cached.data;
    }
    const data = await _getRawSheet(sheetName);
    readCache.set(key, { time: Date.now(), data: data as any });
    return data;
}

/** @deprecated Use `readSheet(SHEETS.HISTORICO_INTERACOES)` instead. */
export async function getHistorySheetCached() {
    return getSheetCached(SHEETS.HISTORICO_INTERACOES);
}

/** @deprecated Use `updateRowByIndex` instead. */
export async function updateRow(rowNumber: number, data: Record<string, any>) {
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData(SHEETS.SHEET1);
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => (headerMap[h] = i));

    const updates: any[] = [];
    for (const key in data) {
        const colIndex = headerMap[key];
        if (colIndex !== undefined) {
            const colLetter = columnNumberToLetter(colIndex + 1);
            const range = `Sheet1!${colLetter}${rowNumber}`;
            updates.push({ range, values: [[data[key]]] });
        }
    }
    if (updates.length) {
        await withRetry(() =>
            sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: process.env.SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates as any,
                },
            })
        );
    }
}
