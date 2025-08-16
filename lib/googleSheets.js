import { google } from 'googleapis';

// ✅ Cache simples em memória
const readCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, delays = [2000, 4000]) {
  try {
    return await fn();
  } catch (err) {
    if ((err?.code === 429 || err?.response?.status === 429) && delays.length) {
      await sleep(delays[0]);
      return withRetry(fn, delays.slice(1));
    }
    throw err;
  }
}

async function withCache(key, fn) {
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.time < 10000) {
    return cached.data;
  }

  const promise = withRetry(fn).then((res) => {
    readCache.set(key, { time: Date.now(), data: res });
    return res;
  }).catch((err) => {
    readCache.delete(key);
    throw err;
  });

  readCache.set(key, { time: Date.now(), data: promise });
  return promise;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_NAME = 'Sheet1';
const HISTORY_SHEET_NAME = 'Historico_Interacoes';

// ✅ Mapeamento de colunas para updateRow
const COLUMN_MAP = {
  cliente_id: 'Cliente_ID',
  cliente: 'Negócio - Organização',
  titulo_negocio: 'Negócio - Título',
  valor_negocio: 'Negócio - Valor',
  pessoa_contato: 'Negócio - Pessoa de contato',
  data_fechamento_esperada: 'Negócio - Data de fechamento esperada',
  etapa: 'Negócio - Etapa',
  fonte_lead: 'Negócio - Fonte do Lead',
  data_criacao: 'Negócio - Data de criação do negócio',
  ganho_em: 'Negócio - Ganho em',
  vlr_mensalidade: 'Negócio - VLR Mensalidade',
  vlr_implantacao: 'Negócio - VLR Implantação',
  status_kanban: 'Status_Kanban',
  cor_card: 'Cor_Card',
  data_ultima_movimentacao: 'Data_Ultima_Movimentacao',
  linkedin_contato: 'Pessoa - End. Linkedin',
  impresso_lista: 'Impresso_Lista',
  telefone_normalizado: 'Telefone Normalizado',
};

// ✅ Mapeamento de colunas da aba de histórico
const HISTORY_COLUMN_MAP = {
  cliente_id: 'Cliente_ID',
  data_hora: 'Data_Hora',
  tipo: 'Tipo',
  de_fase: 'De_Fase',
  para_fase: 'Para_Fase',
  canal: 'Canal',
  observacao: 'Observacao',
  mensagem_usada: 'Mensagem_Usada',
};

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY,
    scopes: SCOPES,
  });
}

async function authorize() {
  const auth = getAuth();
  await auth.authorize();
  return auth;
}

// ✅ Cliente reutilizável do Google Sheets
export async function getSheetsClient() {
  const auth = await authorize();
  return google.sheets({ version: 'v4', auth });
}

// ✅ Leitura genérica de abas retornando cabeçalhos e linhas como objetos
export async function getSheetData(sheetName, spreadsheetId = process.env.SPREADSHEET_ID) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0];
  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
  return { headers, rows: data };
}

function columnToLetter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

async function fetchHeaderInfo(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`,
  });
  const headers = res.data.values ? res.data.values[0] : [];
  const indexMap = {};
  headers.forEach((h, i) => {
    indexMap[h] = i;
  });
  return { headers, indexMap };
}

export async function getHeaderInfo() {
  return fetchHeaderInfo(process.env.SPREADSHEET_ID);
}

export async function getHeaderInfoCached(spreadsheetId = process.env.SPREADSHEET_ID) {
  const key = `header:${spreadsheetId}`;
  return withCache(key, () => fetchHeaderInfo(spreadsheetId));
}

async function fetchSheet(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_NAME,
  });
}

export async function getSheet() {
  return fetchSheet(process.env.SPREADSHEET_ID);
}

export async function getSheetCached(spreadsheetId = process.env.SPREADSHEET_ID) {
  const key = `sheet:${spreadsheetId}`;
  return withCache(key, () => fetchSheet(spreadsheetId));
}

// ---------- Funções para o histórico de interações ----------

async function fetchHistoryHeaderInfo(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HISTORY_SHEET_NAME}!1:1`,
  });
  const headers = res.data.values ? res.data.values[0] : [];
  const indexMap = {};
  headers.forEach((h, i) => {
    indexMap[h] = i;
  });
  return { headers, indexMap };
}

export async function getHistoryHeaderInfo() {
  return fetchHistoryHeaderInfo(process.env.SPREADSHEET_ID);
}

export async function getHistoryHeaderInfoCached(
  spreadsheetId = process.env.SPREADSHEET_ID
) {
  const key = `header-history:${spreadsheetId}`;
  return withCache(key, () => fetchHistoryHeaderInfo(spreadsheetId));
}

async function fetchHistorySheet(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets.spreadsheets.values.get({
    spreadsheetId,
    range: HISTORY_SHEET_NAME,
  });
}

export async function getHistorySheet() {
  return fetchHistorySheet(process.env.SPREADSHEET_ID);
}

export async function getHistorySheetCached(
  spreadsheetId = process.env.SPREADSHEET_ID
) {
  const key = `sheet-history:${spreadsheetId}`;
  return withCache(key, () => fetchHistorySheet(spreadsheetId));
}

/**
 * Protege valores numéricos (como telefones) para não virarem fórmulas.
 */
function protectValue(value) {
  if (typeof value !== 'string') value = String(value || '');

  // Telefones e números internacionais sempre como texto
  if (/^\+?\d{8,}$/.test(value)) {
    return value.startsWith("'") ? value : `'${value}`;
  }
  return value;
}

export async function appendRow(data) {
  const { headers, indexMap } = await getHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = new Array(headers.length).fill('');
  Object.entries(data).forEach(([key, value]) => {
    const header = COLUMN_MAP[key];
    if (header && indexMap[header] !== undefined) {
      row[indexMap[header]] = protectValue(value);
    }
  });
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: SHEET_NAME,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// ✅ Insere linha na aba de histórico de interações
export async function appendHistoryRow(data) {
  const { headers, indexMap } = await getHistoryHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = new Array(headers.length).fill('');
  Object.entries(data).forEach(([key, value]) => {
    const header = HISTORY_COLUMN_MAP[key];
    if (header && indexMap[header] !== undefined) {
      row[indexMap[header]] = protectValue(value);
    }
  });
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: HISTORY_SHEET_NAME,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

/**
 * Appends multiple rows to a specified sheet.
 * @param {string} sheetName The name of the sheet to append to.
 * @param {any[][]} rowsToAppend An array of arrays representing rows of data.
 */
export async function appendSheetData(sheetName, rowsToAppend) {
  if (!sheetName || !rowsToAppend || rowsToAppend.length === 0) {
    throw new Error('sheetName and rowsToAppend are required.');
  }

  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  const protectedRows = rowsToAppend.map(row => row.map(protectValue));

  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: protectedRows,
    },
  });
}

export async function updateRow(rowNumber, data) {
  const { indexMap } = await getHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const requests = Object.entries(data).map(([key, value]) => {
    const header = COLUMN_MAP[key];
    if (!header || indexMap[header] === undefined) return null;
    const colLetter = columnToLetter(indexMap[header]);
    const range = `${SHEET_NAME}!${colLetter}${rowNumber}`;
    return sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[protectValue(value)]] },
    });
  });
  return Promise.all(requests.filter(Boolean));
}

// --- New Functions for Company Enrichment ---

const SHEETS_TO_SEARCH = ['Leads Exact Spotter', 'layout_importacao_empresas', 'Sheet1'];

/**
 * Generates the next sequential Cliente_ID based on the 'Leads Exact Spotter' sheet.
 * @returns {Promise<string>} The next Cliente_ID in the format 'CLI-000001'.
 */
export async function getNextClienteId() {
  // Clear cache for this specific read to ensure we get the latest data
  readCache.delete(`sheetData:Leads Exact Spotter`);

  const { rows } = await getSheetData('Leads Exact Spotter');
  let maxId = 0;
  for (const row of rows) {
    const clienteId = row['Cliente_ID'];
    if (clienteId && typeof clienteId === 'string' && clienteId.startsWith('CLI-')) {
      const num = parseInt(clienteId.substring(4), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  const nextId = maxId + 1;
  return `CLI-${String(nextId).padStart(6, '0')}`;
}

const normalizeText = (str) => {
    if (!str) return '';
    return str.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const normalizeCnpj = (cnpj) => {
    if (!cnpj) return '';
    return cnpj.toString().replace(/\D/g, '');
}


/**
 * Finds a company by its CNPJ across multiple sheets.
 * @param {string} cnpj The CNPJ to search for.
 * @returns {Promise<object|null>} The found row data or null.
 */
export async function findByCnpj(cnpj) {
  const normalizedCnpjToFind = normalizeCnpj(cnpj);
  if (!normalizedCnpjToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowCnpj = row['CNPJ Empresa'];
      if (normalizeCnpj(rowCnpj) === normalizedCnpjToFind) {
        return { ...row, _sheetName: sheetName };
      }
    }
  }
  return null;
}

/**
 * Finds a company by its name, prioritizing entries without a CNPJ.
 * @param {string} name The company name to search for.
 * @returns {Promise<object|null>} The found row data or null.
 */
export async function findByName(name) {
  const normalizedNameToFind = normalizeText(name);
  if (!normalizedNameToFind) return null;

  let bestMatch = null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowName = row['Nome da Empresa'];
      if (normalizeText(rowName) === normalizedNameToFind) {
        const rowCnpj = normalizeCnpj(row['CNPJ Empresa']);
        // A match without a CNPJ is a candidate for enrichment.
        if (!rowCnpj) {
          return { ...row, _sheetName: sheetName };
        }
        // Keep the first match with a CNPJ as a fallback.
        if (!bestMatch) {
            bestMatch = { ...row, _sheetName: sheetName };
        }
      }
    }
  }
  return bestMatch;
}

/**
 * Appends a standardized company payload to the three specified sheets.
 * @param {object} payload The company data, with keys like 'Nome_da_Empresa'.
 */
export async function appendToSheets(payload) {
  const columnOrder = [
    'Cliente_ID', 'Nome da Empresa', 'Site Empresa', 'País Empresa', 'Estado Empresa',
    'Cidade Empresa', 'Logradouro Empresa', 'Numero Empresa', 'Bairro Empresa',
    'Complemento Empresa', 'CEP Empresa', 'CNPJ Empresa', 'DDI Empresa',
    'Telefones Empresa', 'Observação Empresa'
  ];

  // The payload keys have underscores, but the sheet headers have spaces.
  // We need to map them.
  const payloadToSheetHeaderMap = {
      'Cliente_ID': 'Cliente_ID',
      'Nome_da_Empresa': 'Nome da Empresa',
      'Site_Empresa': 'Site Empresa',
      'País_Empresa': 'País Empresa',
      'Estado_Empresa': 'Estado Empresa',
      'Cidade_Empresa': 'Cidade Empresa',
      'Logradouro_Empresa': 'Logradouro Empresa',
      'Numero_Empresa': 'Numero Empresa',
      'Bairro_Empresa': 'Bairro Empresa',
      'Complemento_Empresa': 'Complemento Empresa',
      'CEP_Empresa': 'CEP Empresa',
      'CNPJ_Empresa': 'CNPJ Empresa',
      'DDI_Empresa': 'DDI Empresa',
      'Telefones_Empresa': 'Telefones Empresa',
      'Observacao_Empresa': 'Observação Empresa',
  };


  const rowData = columnOrder.map(header => {
      // Find the payload key that maps to the current header
      const payloadKey = Object.keys(payloadToSheetHeaderMap).find(key => payloadToSheetHeaderMap[key] === header);
      return payload[payloadKey] || '';
  });

  const requests = SHEETS_TO_SEARCH.map(sheetName => {
    // Invalidate cache before writing
    readCache.delete(`sheetData:${sheetName}`);
    return appendSheetData(sheetName, [rowData]);
  });

  await Promise.all(requests);
}


// ✅ Função de agregação com Cliente_ID para relatórios
export function aggregateRows(rows) {
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('Cliente_ID'),
    org: header.indexOf('Organização - Nome'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    email: header.indexOf('Pessoa - Email - Work'),
    status: header.indexOf('Status_Kanban'),
    segmento: header.indexOf('Organização - Segmento'),
    uf: header.indexOf('uf'),
  };

  const map = new Map();
  data.forEach((row) => {
    const clienteId = row[idx.clienteId];
    if (!clienteId) return;
    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row[idx.org] || '',
        contacts: new Map(),
        status: row[idx.status] || '',
        segment: row[idx.segmento] || '',
        uf: row[idx.uf] || '',
      });
    }
    const item = map.get(clienteId);
    const key = `${row[idx.contato] || ''}|${row[idx.email] || ''}`;
    if (!item.contacts.has(key)) {
      item.contacts.set(key, {
        name: row[idx.contato] || '',
        email: row[idx.email] || '',
      });
    }
  });

  return Array.from(map.values()).map((c) => ({
    id: c.id,
    company: c.company,
    contacts: Array.from(c.contacts.values()),
    status: c.status,
    segment: c.segment,
    uf: c.uf,
  }));
}
