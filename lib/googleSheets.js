import { google } from 'googleapis';
import https from 'https';
import { getColumnMapping, mapHeadersToSnakeCase, getOriginalColumnName } from './sheets-mapping';

// --- Cache & Auth ---

const readCache = new Map();
let sheetsClientPromise;

/**
 * Returns a singleton Google Sheets client with keep-alive enabled.
 */
async function getSheetsClient() {
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

  const rawHeaders = rows[0];
  const originalHeaders = rawHeaders.map((h) => (h || '').toString().trim());
  const headers = mapHeadersToSnakeCase(sheetName, originalHeaders);

  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    originalHeaders.forEach((h, i) => {
      const snakeCaseHeader = headers[i];
      if (snakeCaseHeader) obj[snakeCaseHeader] = row[i] ?? '';
    });
    return obj;
  });

  const result = { headers, rows: data };
  readCache.set(key, { time: Date.now(), data: result });
  return result;
}

export async function findRowIndexById(sheetName, headersRow, idColumnName, idValue) {
  if (!process.env.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const normalizedId = String(idValue || '').trim();
  const { headers, rows } = await getSheetData(sheetName, `A${headersRow}:ZZ`);
  // idColumnName é esperado em snake_case
  const idIdx = headers.indexOf(idColumnName);
  if (idIdx === -1) return -1;
  for (const row of rows) {
    const cell = String(row[idColumnName] || '').trim();
    if (cell === normalizedId) {
      return row._rowNumber;
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
  const { headers: snakeCaseHeaders } = await getSheetData(sheetName);
  const originalHeadersMap = getColumnMapping(sheetName);
  const headerMap = {};
  for (const original in originalHeadersMap) {
    const snakeCase = originalHeadersMap[original];
    const index = snakeCaseHeaders.indexOf(snakeCase);
    if (index !== -1) {
      headerMap[snakeCase] = { index, original };
    }
  }

  const data = [];
  // `updates` está em snake_case
  Object.entries(updates || {}).forEach(([snakeCaseCol, value]) => {
    const mapInfo = headerMap[snakeCaseCol];
    if (!mapInfo) return;

    const { index, original: originalCol } = mapInfo;
    const colLetter = columnNumberToLetter(index + 1);
    const range = `${sheetName}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
    data.push({ range, values: [[value]] });
    console.log('[updateRowByIndex]', {
      sheetName,
      rowIndex,
      campoAtualizadoSnakeCase: snakeCaseCol,
      campoAtualizadoOriginal: originalCol,
      valorNovo: value,
      rangeUsado: range,
    });
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

export async function _findRowNumberByClienteId(sheetName, clienteId) {
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
  if (!uf) return '';
  const map = { AC:'AC',AL:'AL',AP:'AP',AM:'AM',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MT:'MT',MS:'MS',MG:'MG',PA:'PA',PB:'PB',PR:'PR',PE:'PE',PI:'PI',RJ:'RJ',RN:'RN',RS:'RS',RO:'RO',RR:'RR',SC:'SC',SP:'SP',SE:'SE',TO:'TO',ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO' };
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

function columnNumberToLetter(columnNumber) {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}


// --- Row Builders for Each Sheet Layout ---

function buildLeadsExactSpotterRow(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const sheetName = 'Leads Exact Spotter';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    const row = columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome do Lead': return Empresa.Nome_da_Empresa;
            case 'Origem': return Comercial.Origem;
            case 'Sub-Origem': return Comercial.Sub_Origem;
            case 'Mercado': return Comercial.Mercado;
            case 'Produto': return Comercial.Produto;
            case 'Site': return Empresa.Site_Empresa;
            case 'País': return Empresa.País_Empresa;
            case 'Estado': return Empresa.Estado_Empresa;
            case 'Cidade': return Empresa.Cidade_Empresa;
            case 'Logradouro': return Empresa.Logradouro_Empresa;
            case 'Número': return Empresa.Numero_Empresa;
            case 'Bairro': return Empresa.Bairro_Empresa;
            case 'Complemento': return Empresa.Complemento_Empresa;
            case 'CEP': return Empresa.CEP_Empresa;
            case 'DDI': return Empresa.DDI_Empresa;
            case 'Telefones': return Empresa.Telefones_Empresa;
            case 'Observação': return Empresa.Observacao_Empresa;
            case 'CPF/CNPJ': return normalizeCnpj(Empresa.CNPJ_Empresa);
            case 'Nome Contato': return Contato.Nome_Contato;
            case 'E-mail Contato': return Contato.Email_Contato;
            case 'Cargo Contato': return Contato.Cargo_Contato;
            case 'DDI Contato': return Contato.DDI_Contato;
            case 'Telefones Contato': return Contato.Telefones_Contato;
            case 'Tipo do Serv. Comunicação': return Comercial.Tipo_do_Serv_Comunicacao;
            case 'ID do Serv. Comunicação': return Comercial.ID_do_Serv_Comunicacao;
            case 'Área': return Comercial.Área;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Etapa': return Comercial.Etapa;
            case 'Funil': return Comercial.Funil;
            default: return '';
        }
    });
    return row;
}

function buildLayoutImportacaoRow(payload) {
    const { Empresa } = payload;
    const sheetName = 'layout_importacao_empresas';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Site Empresa': return Empresa.Site_Empresa;
            case 'País Empresa': return Empresa.País_Empresa;
            case 'Estado Empresa': return Empresa.Estado_Empresa;
            case 'Cidade Empresa': return Empresa.Cidade_Empresa;
            case 'Logradouro Empresa': return Empresa.Logradouro_Empresa;
            case 'Numero Empresa': return Empresa.Numero_Empresa;
            case 'Bairro Empresa': return Empresa.Bairro_Empresa;
            case 'Complemento Empresa': return Empresa.Complemento_Empresa;
            case 'CEP Empresa': return Empresa.CEP_Empresa;
            case 'CNPJ Empresa': return normalizeCnpj(Empresa.CNPJ_Empresa);
            case 'DDI Empresa': return Empresa.DDI_Empresa;
            case 'Telefones Empresa': return Empresa.Telefones_Empresa;
            case 'Observação Empresa': return Empresa.Observacao_Empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const { Work, Home, Mobile, Other } = distributeContactPhones(Contato.Telefones_Contato);
    const sheetName = 'Sheet1';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Negócio - Título': return Comercial.Título_Negocio;
            case 'Negócio - Origem / Canal de origem': return Comercial.Origem;
            case 'Negócio - Fonte do Lead': return Comercial.Sub_Origem;
            case 'Organização - Segmento': return Comercial.Mercado;
            case 'Negócio - Nome do produto': return Comercial.Produto;
            case 'País': return Empresa.País_Empresa;
            case 'uf': return normalizeUF(Empresa.Estado_Empresa);
            case 'cidade_estimada': return Empresa.Cidade_Empresa;
            case 'Telefone Normalizado': return normalizePhoneNumber(Empresa.Telefones_Empresa, Empresa.DDI_Empresa);
            case 'Negócio - Pessoa de contato': return Contato.Nome_Contato;
            case 'Pessoa - Email - Work': return Contato.Email_Contato;
            case 'Pessoa - Email - Home': return Contato.Email_Contato_Home;
            case 'Pessoa - Email - Other': return Contato.Email_Contato_Other;
            case 'Pessoa - Cargo': return Contato.Cargo_Contato;
            case 'Pessoa - Phone - Work': return Work;
            case 'Pessoa - Phone - Home': return Home;
            case 'Pessoa - Phone - Mobile': return Mobile;
            case 'Pessoa - Phone - Other': return Other;
            case 'Organização - Nome': return Empresa.Nome_da_Empresa;
            case 'Funil': return Comercial.Funil;
            default: return '';
        }
    });
}


// --- Main Public Functions ---

export async function getNextClienteId() {
  const sheetName = 'Leads Exact Spotter';
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
    const sheetName = 'Historico_Interacoes'; // Assumindo que esta aba não está no mapeamento e usa headers originais
    const { headers } = await getSheetData(sheetName);
    // Assumindo que 'data' está em snake_case e precisamos mapear de volta.
    // Como 'Historico_Interacoes' não está no mapeamento, vamos manter o comportamento original,
    // mas o getSheetData agora retorna snake_case.
    // Se o mapeamento não existe, getSheetData retorna os headers originais como snake_case (fallback).
    
    // Vamos usar a função de mapeamento para garantir que estamos usando os headers originais para a escrita.
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping).length > 0 ? Object.keys(mapping) : headers;

    const row = columnOrder.map(header => data[header] || '');
    return appendSheetData(sheetName, [row]);
}

export async function updateInSheets(clienteId, payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders = {
        'Leads Exact Spotter': buildLeadsExactSpotterRow,
        'layout_importacao_empresas': buildLayoutImportacaoRow,
        'Sheet1': buildSheet1Row,
    };

    for (const sheetName in sheetBuilders) {
        readCache.delete(`sheetData:${sheetName}`);
        // _findRowNumberByClienteId agora usa 'cliente_id' em snake_case
        const rowNumber = await _findRowNumberByClienteId(sheetName, clienteId); 
        if (rowNumber === -1) {
            console.warn(`cliente_id ${clienteId} not found in ${sheetName}. Skipping update.`);
            continue;
        }

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

// Funções auxiliares que não foram modificadas
// ... (normalizeText, normalizeCnpj, normalizeUF, normalizePhoneNumber, distributeContactPhones, isValidEmail, columnNumberToLetter)
// ... (mas foram incluídas no write para garantir a integridade do arquivo)

// A função appendHistoryRow foi ajustada para tentar usar o mapeamento, mas como não está no JSON,
// ela deve usar os headers retornados pelo getSheetData (que serão os originais se não houver mapeamento).
// No entanto, o `getSheetData` agora retorna headers em snake_case.
// A função `appendHistoryRow` original usava:
// const { headers } = await getSheetData('Historico_Interacoes');
// const row = headers.map(header => data[header] || '');
// Onde `headers` eram os nomes originais e `data` era um objeto com chaves originais.
// Agora, `headers` são snake_case e `data` (assumindo que o chamador foi atualizado) é snake_case.
// Se a aba não está no mapeamento, `mapHeadersToSnakeCase` retorna os headers originais.
// O `getSheetData` modificado retorna os headers em snake_case (se mapeado) ou os originais (se não mapeado).
// Vamos simplificar `appendHistoryRow` para usar o comportamento do `getSheetData` modificado.

/*
export async function appendHistoryRow(data) {
    const { headers } = await getSheetData('Historico_Interacoes');
    const row = headers.map(header => data[header] || '');
    return appendSheetData('Historico_Interacoes', [row]);
}
*/
// Revertendo a alteração em appendHistoryRow para a versão mais simples e correta:
// Se a aba não está no mapeamento, getSheetData retorna os headers originais.
// O chamador de appendHistoryRow deve fornecer `data` com chaves correspondentes aos headers retornados.
// Como não temos visibilidade do chamador, vamos manter a lógica original, mas usando a versão modificada do getSheetData.

/*
export async function appendHistoryRow(data) {
    const { headers } = await getSheetData('Historico_Interacoes');
    const row = headers.map(header => data[header] || '');
    return appendSheetData('Historico_Interacoes', [row]);
}
*/

// Vamos reescrever o arquivo completo, incluindo as funções auxiliares que não foram modificadas, para garantir a integridade.

/*
// Conteúdo completo de lib/googleSheets.js (versão final após modificações)
import { google } from 'googleapis';
import https from 'https';
import { getColumnMapping, mapHeadersToSnakeCase, getOriginalColumnName } from './sheets-mapping';

// --- Cache & Auth ---

const readCache = new Map();
let sheetsClientPromise;

/**
 * Returns a singleton Google Sheets client with keep-alive enabled.
 */
async function getSheetsClient() {
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

  const rawHeaders = rows[0];
  const originalHeaders = rawHeaders.map((h) => (h || '').toString().trim());
  const headers = mapHeadersToSnakeCase(sheetName, originalHeaders);

  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    originalHeaders.forEach((h, i) => {
      const snakeCaseHeader = headers[i];
      if (snakeCaseHeader) obj[snakeCaseHeader] = row[i] ?? '';
    });
    return obj;
  });

  const result = { headers, rows: data };
  readCache.set(key, { time: Date.now(), data: result });
  return result;
}

export async function findRowIndexById(sheetName, headersRow, idColumnName, idValue) {
  if (!process.env.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const normalizedId = String(idValue || '').trim();
  const { headers, rows } = await getSheetData(sheetName, `A${headersRow}:ZZ`);
  // idColumnName é esperado em snake_case
  const idIdx = headers.indexOf(idColumnName);
  if (idIdx === -1) return -1;
  for (const row of rows) {
    const cell = String(row[idColumnName] || '').trim();
    if (cell === normalizedId) {
      return row._rowNumber;
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
  const { headers: snakeCaseHeaders } = await getSheetData(sheetName);
  const originalHeadersMap = getColumnMapping(sheetName);
  const headerMap = {};
  for (const original in originalHeadersMap) {
    const snakeCase = originalHeadersMap[original];
    const index = snakeCaseHeaders.indexOf(snakeCase);
    if (index !== -1) {
      headerMap[snakeCase] = { index, original };
    }
  }

  const data = [];
  // `updates` está em snake_case
  Object.entries(updates || {}).forEach(([snakeCaseCol, value]) => {
    const mapInfo = headerMap[snakeCaseCol];
    if (!mapInfo) return;

    const { index, original: originalCol } = mapInfo;
    const colLetter = columnNumberToLetter(index + 1);
    const range = `${sheetName}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
    data.push({ range, values: [[value]] });
    console.log('[updateRowByIndex]', {
      sheetName,
      rowIndex,
      campoAtualizadoSnakeCase: snakeCaseCol,
      campoAtualizadoOriginal: originalCol,
      valorNovo: value,
      rangeUsado: range,
    });
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

export async function _findRowNumberByClienteId(sheetName, clienteId) {
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
  if (!uf) return '';
  const map = { AC:'AC',AL:'AL',AP:'AP',AM:'AM',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MT:'MT',MS:'MS',MG:'MG',PA:'PA',PB:'PB',PR:'PR',PE:'PE',PI:'PI',RJ:'RJ',RN:'RN',RS:'RS',RO:'RO',RR:'RR',SC:'SC',SP:'SP',SE:'SE',TO:'TO',ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO' };
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

function columnNumberToLetter(columnNumber) {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}


// --- Row Builders for Each Sheet Layout ---

function buildLeadsExactSpotterRow(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const sheetName = 'Leads Exact Spotter';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    const row = columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome do Lead': return Empresa.Nome_da_Empresa;
            case 'Origem': return Comercial.Origem;
            case 'Sub-Origem': return Comercial.Sub_Origem;
            case 'Mercado': return Comercial.Mercado;
            case 'Produto': return Comercial.Produto;
            case 'Site': return Empresa.Site_Empresa;
            case 'País': return Empresa.País_Empresa;
            case 'Estado': return Empresa.Estado_Empresa;
            case 'Cidade': return Empresa.Cidade_Empresa;
            case 'Logradouro': return Empresa.Logradouro_Empresa;
            case 'Número': return Empresa.Numero_Empresa;
            case 'Bairro': return Empresa.Bairro_Empresa;
            case 'Complemento': return Empresa.Complemento_Empresa;
            case 'CEP': return Empresa.CEP_Empresa;
            case 'DDI': return Empresa.DDI_Empresa;
            case 'Telefones': return Empresa.Telefones_Empresa;
            case 'Observação': return Empresa.Observacao_Empresa;
            case 'CPF/CNPJ': return normalizeCnpj(Empresa.CNPJ_Empresa);
            case 'Nome Contato': return Contato.Nome_Contato;
            case 'E-mail Contato': return Contato.Email_Contato;
            case 'Cargo Contato': return Contato.Cargo_Contato;
            case 'DDI Contato': return Contato.DDI_Contato;
            case 'Telefones Contato': return Contato.Telefones_Contato;
            case 'Tipo do Serv. Comunicação': return Comercial.Tipo_do_Serv_Comunicacao;
            case 'ID do Serv. Comunicação': return Comercial.ID_do_Serv_Comunicacao;
            case 'Área': return Comercial.Área;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Etapa': return Comercial.Etapa;
            case 'Funil': return Comercial.Funil;
            default: return '';
        }
    });
    return row;
}

function buildLayoutImportacaoRow(payload) {
    const { Empresa } = payload;
    const sheetName = 'layout_importacao_empresas';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Site Empresa': return Empresa.Site_Empresa;
            case 'País Empresa': return Empresa.País_Empresa;
            case 'Estado Empresa': return Empresa.Estado_Empresa;
            case 'Cidade Empresa': return Empresa.Cidade_Empresa;
            case 'Logradouro Empresa': return Empresa.Logradouro_Empresa;
            case 'Numero Empresa': return Empresa.Numero_Empresa;
            case 'Bairro Empresa': return Empresa.Bairro_Empresa;
            case 'Complemento Empresa': return Empresa.Complemento_Empresa;
            case 'CEP Empresa': return Empresa.CEP_Empresa;
            case 'CNPJ Empresa': return normalizeCnpj(Empresa.CNPJ_Empresa);
            case 'DDI Empresa': return Empresa.DDI_Empresa;
            case 'Telefones Empresa': return Empresa.Telefones_Empresa;
            case 'Observação Empresa': return Empresa.Observacao_Empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const { Work, Home, Mobile, Other } = distributeContactPhones(Contato.Telefones_Contato);
    const sheetName = 'Sheet1';
    const mapping = getColumnMapping(sheetName);
    const columnOrder = Object.keys(mapping); // Ordem dos headers originais

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Negócio - Título': return Comercial.Título_Negocio;
            case 'Negócio - Origem / Canal de origem': return Comercial.Origem;
            case 'Negócio - Fonte do Lead': return Comercial.Sub_Origem;
            case 'Organização - Segmento': return Comercial.Mercado;
            case 'Negócio - Nome do produto': return Comercial.Produto;
            case 'País': return Empresa.País_Empresa;
            case 'uf': return normalizeUF(Empresa.Estado_Empresa);
            case 'cidade_estimada': return Empresa.Cidade_Empresa;
            case 'Telefone Normalizado': return normalizePhoneNumber(Empresa.Telefones_Empresa, Empresa.DDI_Empresa);
            case 'Negócio - Pessoa de contato': return Contato.Nome_Contato;
            case 'Pessoa - Email - Work': return Contato.Email_Contato;
            case 'Pessoa - Email - Home': return Contato.Email_Contato_Home;
            case 'Pessoa - Email - Other': return Contato.Email_Contato_Other;
            case 'Pessoa - Cargo': return Contato.Cargo_Contato;
            case 'Pessoa - Phone - Work': return Work;
            case 'Pessoa - Phone - Home': return Home;
            case 'Pessoa - Phone - Mobile': return Mobile;
            case 'Pessoa - Phone - Other': return Other;
            case 'Organização - Nome': return Empresa.Nome_da_Empresa;
            case 'Funil': return Comercial.Funil;
            default: return '';
        }
    });
}


// --- Main Public Functions ---

export async function getNextClienteId() {
  const sheetName = 'Leads Exact Spotter';
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

export async function updateInSheets(clienteId, payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders = {
        'Leads Exact Spotter': buildLeadsExactSpotterRow,
        'layout_importacao_empresas': buildLayoutImportacaoRow,
        'Sheet1': buildSheet1Row,
    };

    for (const sheetName in sheetBuilders) {
        readCache.delete(`sheetData:${sheetName}`);
        // _findRowNumberByClienteId agora usa 'cliente_id' em snake_case
        const rowNumber = await _findRowNumberByClienteId(sheetName, clienteId); 
        if (rowNumber === -1) {
            console.warn(`cliente_id ${clienteId} not found in ${sheetName}. Skipping update.`);
            continue;
        }

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
*/
