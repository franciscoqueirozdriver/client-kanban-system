import { google } from 'googleapis';
import https from 'https';
import { getColumnMapping, mapHeadersToSnakeCase, getOriginalColumnName, mapSheetRowToSnakeObject } from './sheets-mapping';

// --- Cache & Auth ---

const readCache = new Map();
let sheetsClientPromise;

/**
 * Returns a singleton Google Sheets client with keep-alive enabled.
 */
export async function getSheetsClient() {
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
      const httpAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
      google.options({ auth, httpAgent });
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
export async function withRetry(fn, tries = 4) {
  let attempt = 0;
  let lastErr;
  while (attempt < tries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.code || err?.response?.status || 0;
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

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// --- Generic Sheet Interaction ---

export async function getSheetData(sheetName, range = 'A:ZZ', spreadsheetId = process.env.SPREADSHEET_ID) {
  const key = `sheetData:${sheetName}:${range}`;
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.time < 10000) {
    return cached.data;
  }

  const sheets = await getSheetsClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    })
  );
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], rows: [] };

  const originalHeaders = rows[0].map((h) => (h || '').toString().trim());

  const data = rows.slice(1).map((row, idx) => {
    const snakeObject = mapSheetRowToSnakeObject(sheetName, originalHeaders, row);
    snakeObject._rowNumber = idx + 2;
    return snakeObject;
  });

  const result = { headers: mapHeadersToSnakeCase(sheetName, originalHeaders), rows: data };
  readCache.set(key, { time: Date.now(), data: result });
  return result;
}

export async function findRowIndexById(sheetName, headersRow, idColumnName, idValue) {
  if (!process.env.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const normalizedId = String(idValue || '').trim();
  const sheets = await getSheetsClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `${sheetName}!A${headersRow}:ZZ`,
    })
  );
  const rows = res.data.values || [];
  if (rows.length === 0) return -1;

  const originalHeaders = rows[0].map((h) => (h || '').toString().trim());
  const headers = mapHeadersToSnakeCase(sheetName, originalHeaders);
  const idIdx = headers.indexOf(idColumnName);
  if (idIdx === -1) return -1;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cell = String(row[idIdx] || '').trim();
    if (cell === normalizedId) {
      return i + headersRow;
    }
  }
  return -1;
}

export async function updateRowByIndex({ sheetName, rowIndex, updates }) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const sheets = await getSheetsClient();
  
  // Precisamos do cabeçalho original para mapear a posição da coluna
  const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `${sheetName}!A1:ZZ1`,
  });
  const originalHeaders = (res.data.values || [])[0] || [];
  const snakeCaseHeaders = mapHeadersToSnakeCase(sheetName, originalHeaders);
  const data = [];
  // `updates` está em snake_case
  Object.entries(updates || {}).forEach(([snakeCaseCol, value]) => {
    const originalCol = getOriginalColumnName(sheetName, snakeCaseCol);
    if (!originalCol) return;

    const index = snakeCaseHeaders.indexOf(snakeCaseCol);
    if (index === -1) return;

    const colLetter = columnNumberToLetter(index + 1);
    const range = `${originalCol}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
    data.push({ range, values: [[value]] });
  });
  if (!data.length) return;
  await withRetry(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data,
      },
    })
  );
}

export async function findRowNumberByClienteId(sheetName, clienteId) {
    const { rows } = await getSheetData(sheetName);
    // Agora 'rows' usa 'cliente_id' em snake_case
    const rowIndex = rows.findIndex(row => row.cliente_id === clienteId);
    return rowIndex !== -1 ? rows[rowIndex]._rowNumber : -1;
}


// --- Data Transformation Helpers ---

function normalizeText(str) {
    return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCnpj(cnpj) {
    return (cnpj || '').toString().replace(/\D/g, '');
}

function normalizeUF(uf) {
  if (!uf) return "";

  // Normalize: remove diacritics, uppercase, collapse spaces
  const cleaned = String(uf)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  // Key → UF (uses Map to avoid colon-heavy object literal parsing issues)
  const map = new Map([
    ["AC", "AC"], ["AL", "AL"], ["AP", "AP"], ["AM", "AM"], ["BA", "BA"],
    ["CE", "CE"], ["DF", "DF"], ["ES", "ES"], ["GO", "GO"], ["MA", "MA"],
    ["MT", "MT"], ["MS", "MS"], ["MG", "MG"], ["PA", "PA"], ["PB", "PB"],
    ["PR", "PR"], ["PE", "PE"], ["PI", "PI"], ["RJ", "RJ"], ["RN", "RN"],
    ["RS", "RS"], ["RO", "RO"], ["RR", "RR"], ["SC", "SC"], ["SP", "SP"],
    ["SE", "SE"], ["TO", "TO"],

    ["ACRE", "AC"], ["ALAGOAS", "AL"], ["AMAPA", "AP"], ["AMAZONAS", "AM"],
    ["BAHIA", "BA"], ["CEARA", "CE"], ["DISTRITO FEDERAL", "DF"],
    ["ESPIRITO SANTO", "ES"], ["GOIAS", "GO"], ["MARANHAO", "MA"],
    ["MATO GROSSO", "MT"], ["MATO GROSSO DO SUL", "MS"], ["MINAS GERAIS", "MG"],
    ["PARA", "PA"], ["PARAIBA", "PB"], ["PARANA", "PR"], ["PERNAMBUCO", "PE"],
    ["PIAUI", "PI"], ["RIO DE JANEIRO", "RJ"], ["RIO GRANDE DO NORTE", "RN"],
    ["RIO GRANDE DO SUL", "RS"], ["RONDONIA", "RO"], ["RORAIMA", "RR"],
    ["SANTA CATARINA", "SC"], ["SAO PAULO", "SP"], ["SERGIPE", "SE"],
    ["TOCANTINS", "TO"],
  ]);

  return map.get(cleaned) || "";
}

export async function findByCnpj(cnpj) {
  const { rows } = await getSheetData('Sheet1');
  return rows.find(row => row.cpf_cnpj === normalizeCnpj(cnpj));
}

export async function findByName(name) {
  const { rows } = await getSheetData('Sheet1');
  return rows.find(row => row.nome_do_lead === name);
}

export async function appendToSheets(sheetName, data) {
  return appendSheetData(sheetName, data);
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

function columnNumberToLetter(columnNumber) {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}


// --- Main Public Functions ---

export async function getNextClienteId() {
  const sheetName = 'Sheet1';
  readCache.delete(`sheetData:${sheetName}`);
  const { rows } = await getSheetData(sheetName);
  let maxId = 0;
  for (const row of rows) {
    // 'cliente_id' agora é em snake_case
    const clienteId = row['cliente_id']; 
    if (clienteId && typeof clienteId === 'string') {
      // Handle both "CLI-" and "CLT-" prefixes
      if (clienteId.startsWith('CLI-') || clienteId.startsWith('CLT-')) {
        const num = parseInt(clienteId.substring(4), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
  }
  // Generate new IDs with the correct "CLT-" prefix and no zero-padding
  return `CLT-${maxId + 1}`;
}

export async function appendSheetData(sheetName, data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const sheets = await getSheetsClient();
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: data },
    })
  );
  readCache.delete(`sheetData:${sheetName}`);
}

export async function getSheet1Headers() {
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData('Sheet1');
    return headers; // Retorna headers em snake_case
}

export async function updateCorCard(rowNumber, cor) {
    const sheets = await getSheetsClient();
    // getSheetData agora retorna headers em snake_case
    const { headers } = await getSheetData('Sheet1'); 
    const colIndexSnakeCase = headers.indexOf('cor_card');

    if (colIndexSnakeCase === -1) {
        console.error("Coluna 'cor_card' não encontrada na Sheet1.");
        return;
    }

    const colLetter = columnNumberToLetter(colIndexSnakeCase + 1);
    const range = `Sheet1!${colLetter}${rowNumber}:${colLetter}${rowNumber}`;

    await withRetry(() =>
        sheets.spreadsheets.values.update({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[cor]] },
        })
    );
}

export async function updateSheet1(rowNumber, data) {
    // 'data' já deve estar em snake_case
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData('Sheet1'); // headers em snake_case
    const headerMap = {};
    headers.forEach((h, i) => (headerMap[h] = i));

    const updates = [];
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
                    data: updates,
                },
            })
        );
    }
}

export async function appendRow(data) {
    const sheetName = 'Sheet1';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Headers originais na ordem correta

    // Build the row array based on the canonical order, not the physical sheet order.
    // 'data' deve ser um objeto com chaves em snake_case
    const row = columnOrder.map(originalHeader => {
        const snakeCaseHeader = mapping[originalHeader];
        return data[snakeCaseHeader] || '';
    });
    return appendSheetData(sheetName, [row]);
}

export async function appendHistoryRow(data) {
    const sheetName = 'Historico_Interacoes';
    const { headers } = await getSheetData(sheetName);
    // Como 'Historico_Interacoes' não está no mapeamento, headers será o nome original.
    // Assumindo que o chamador de appendHistoryRow está fornecendo 'data' com chaves originais.
    // Se o chamador foi atualizado para usar snake_case, isso pode quebrar.
    // No entanto, a tarefa é padronizar os acessos para os nomes no JSON.
    // Como 'Historico_Interacoes' não está no JSON, vamos manter a lógica original, 
    // mas usando os headers retornados pelo getSheetData (que serão os originais se não houver mapeamento).
    
    const row = headers.map(header => data[header] || '');
    return appendSheetData(sheetName, [row]);
}

export async function updateRow(sheetName, rowIndex, data) {
  return updateRowByIndex({ sheetName, rowIndex, updates: data });
}

export async function getSheetCached(sheetName) {
  return getSheetData(sheetName);
}

export async function getHistorySheetCached() {
  return getSheetData('Historico_Interacoes');
}

export async function getSheet(sheetName) {
  return getSheetData(sheetName);
}

export async function updateInSheets(clienteId, payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetNames = ['sheet1', 'layout_importacao_empresas'];

    for (const sheetName of sheetNames) {
        readCache.delete(`sheetData:${sheetName}`);
        const rowNumber = await findRowNumberByClienteId(sheetName, clienteId);
        if (rowNumber === -1) {
            console.warn(`cliente_id ${clienteId} not found in ${sheetName}. Skipping update.`);
            continue;
        }

        const { headers } = await getSheetData(sheetName);
        const originalHeaders = Object.keys(getColumnMapping(sheetName));

        const rowValues = originalHeaders.map(header => {
            const snakeCaseKey = getColumnMapping(sheetName)[header];
            return payload[snakeCaseKey] || '';
        });

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
