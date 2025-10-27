import { google } from 'googleapis';
import { getSheetName, getColumnName, getFullMapping } from './sheetMapping.js';

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

// ✅ Nomes de abas normalizados
const SHEET_NAME = getSheetName('Sheet1');
const HISTORY_SHEET_NAME = getSheetName('Historico_Interacoes');
const COMPANY_IMPORT_SHEET_NAME = getSheetName('layout_importacao_empresas');

// ✅ Mapeamento de colunas para updateRow (usando nomes legados como chave)
const COLUMN_MAP = {
  cliente_id: getColumnName('Cliente_ID'),
  cliente: getColumnName('Negócio - Organização'),
  titulo_negocio: getColumnName('Negócio - Título'),
  valor_negocio: getColumnName('Negócio - Valor'),
  pessoa_contato: getColumnName('Negócio - Pessoa de contato'),
  data_fechamento_esperada: getColumnName('Negócio - Data de fechamento esperada'),
  etapa: getColumnName('Negócio - Etapa'),
  fonte_lead: getColumnName('Negócio - Fonte do Lead'),
  data_criacao: getColumnName('Negócio - Data de criação do negócio'),
  ganho_em: getColumnName('Negócio - Ganho em'),
  vlr_mensalidade: getColumnName('Negócio - VLR Mensalidade'),
  vlr_implantacao: getColumnName('Negócio - VLR Implantação'),
  status_kanban: getColumnName('Status_Kanban'),
  cor_card: getColumnName('Cor_Card'),
  data_ultima_movimentacao: getColumnName('Data_Ultima_Movimentacao'),
  linkedin_contato: getColumnName('Pessoa - End. Linkedin'),
  impresso_lista: getColumnName('Impresso_Lista'),
  telefone_normalizado: getColumnName('Telefone Normalizado'),
};

// ✅ Mapeamento de colunas da aba de histórico
const HISTORY_COLUMN_MAP = {
  cliente_id: getColumnName('Cliente_ID'),
  data_hora: getColumnName('Data_Hora'),
  tipo: getColumnName('Tipo'),
  de_fase: getColumnName('De_Fase'),
  para_fase: getColumnName('Para_Fase'),
  canal: getColumnName('Canal'),
  observacao: getColumnName('Observacao'),
  mensagem_usada: getColumnName('Mensagem_Usada'),
};

// ✅ Mapeamento para aba de importação de empresas
const COMPANY_COLUMN_MAP = {
  nome: getColumnName('nome_da_empresa'),
  site: getColumnName('site_empresa'),
  pais: getColumnName('pais_empresa'),
  estado: getColumnName('estado_empresa'),
  cidade: getColumnName('cidade_empresa'),
  logradouro: getColumnName('logradouro_empresa'),
  numero: getColumnName('numero_empresa'),
  bairro: getColumnName('bairro_empresa'),
  complemento: getColumnName('complemento_empresa'),
  cep: getColumnName('cep_empresa'),
  cnpj: getColumnName('cnpj_empresa'),
  ddi: getColumnName('ddi_empresa'),
  telefone: getColumnName('telefones_empresa'),
  telefone2: getColumnName('telefones_empresa'),
  observacao: getColumnName('observacao_empresa'),
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

// ---------- Funções para a aba de importação de empresas ----------
async function fetchCompanyHeaderInfo(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${COMPANY_IMPORT_SHEET_NAME}!1:1`,
  });
  const headers = res.data.values ? res.data.values[0] : [];
  const indexMap = {};
  headers.forEach((h, i) => {
    indexMap[h] = i;
  });
  return { headers, indexMap };
}

export async function getCompanyHeaderInfo() {
  return fetchCompanyHeaderInfo(process.env.SPREADSHEET_ID);
}

export async function getCompanyHeaderInfoCached(
  spreadsheetId = process.env.SPREADSHEET_ID
) {
  const key = `header-company:${spreadsheetId}`;
  return withCache(key, () => fetchCompanyHeaderInfo(spreadsheetId));
}

async function fetchCompanySheet(spreadsheetId = process.env.SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets.spreadsheets.values.get({
    spreadsheetId,
    range: COMPANY_IMPORT_SHEET_NAME,
  });
}

export async function getCompanySheet() {
  return fetchCompanySheet(process.env.SPREADSHEET_ID);
}

export async function getCompanySheetCached(
  spreadsheetId = process.env.SPREADSHEET_ID
) {
  const key = `sheet-company:${spreadsheetId}`;
  return withCache(key, () => fetchCompanySheet(spreadsheetId));
}

export async function appendCompanyImportRow(data) {
  const { headers, indexMap } = await getCompanyHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = new Array(headers.length).fill('');
  Object.entries(data).forEach(([key, value]) => {
    const header = COMPANY_COLUMN_MAP[key];
    if (header && indexMap[header] !== undefined) {
      row[indexMap[header]] = protectValue(value);
    }
  });
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: COMPANY_IMPORT_SHEET_NAME,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
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

// ✅ Função de agregação com Cliente_ID para relatórios
export function aggregateRows(rows) {
  const [header, ...data] = rows;
  
  // Usar nomes normalizados para buscar índices
  const clienteIdCol = getColumnName('Cliente_ID');
  const orgCol = getColumnName('Organização - Nome');
  const contatoCol = getColumnName('Negócio - Pessoa de contato');
  const emailCol = getColumnName('Pessoa - Email - Work');
  const statusCol = getColumnName('Status_Kanban');
  const segmentoCol = getColumnName('Organização - Segmento');
  const ufCol = getColumnName('uf');
  
  const idx = {
    clienteId: header.indexOf(clienteIdCol),
    org: header.indexOf(orgCol),
    contato: header.indexOf(contatoCol),
    email: header.indexOf(emailCol),
    status: header.indexOf(statusCol),
    segmento: header.indexOf(segmentoCol),
    uf: header.indexOf(ufCol),
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

// ✅ Exporta funções de mapeamento para uso em outros módulos
export { getSheetName, getColumnName, getFullMapping };



// ✅ Funções auxiliares para compatibilidade com código antigo

/**
 * Função compatível que retorna dados de uma aba específica
 * @param {string} sheetName - Nome da aba
 * @param {string} range - Range (ex: 'A:ZZ')
 * @returns {Promise<{headers: string[], rows: object[]}>}
 */
export async function getSheetData(sheetName, range = 'A:ZZ') {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });
  
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], rows: [] };
  
  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h) => (h || '').toString().trim());
  
  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? '';
    });
    return obj;
  });
  
  return { headers, rows: data };
}

/**
 * Função compatível que adiciona dados a uma aba
 * @param {string} sheetName - Nome da aba
 * @param {object} data - Dados a adicionar
 */
export async function appendSheetData(sheetName, data) {
  const { headers, indexMap } = await getHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = new Array(headers.length).fill('');
  Object.entries(data).forEach(([key, value]) => {
    const idx = indexMap[key];
    if (idx !== undefined) {
      row[idx] = protectValue(value);
    }
  });
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

/**
 * Atualiza dados em uma aba
 */
export async function updateInSheets(sheetName, rowNumber, data) {
  const { headers, indexMap } = await getHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const requests = Object.entries(data).map(([key, value]) => {
    const idx = indexMap[key];
    if (idx === undefined) return null;
    const colLetter = columnToLetter(idx);
    const range = `${sheetName}!${colLetter}${rowNumber}`;
    return sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[protectValue(value)]] },
    });
  });
  return Promise.all(requests.filter(Boolean));
}

/**
 * Encontra uma linha por CNPJ
 */
export async function findByCnpj(cnpj) {
  const { rows } = await getSheetData(SHEET_NAME);
  const cnpjCol = getColumnName('cnpj_empresa');
  return rows.find(row => row[cnpjCol] === cnpj);
}

/**
 * Encontra uma linha por nome
 */
export async function findByName(name) {
  const { rows } = await getSheetData(SHEET_NAME);
  const nomeCol = getColumnName('nome_da_empresa');
  return rows.find(row => row[nomeCol] === name);
}

/**
 * Obtém o próximo ID de cliente
 */
export async function getNextClienteId() {
  const { rows } = await getSheetData(SHEET_NAME);
  const clienteIdCol = getColumnName('Cliente_ID');
  const ids = rows
    .map(row => {
      const id = row[clienteIdCol];
      return typeof id === 'string' ? parseInt(id, 10) : 0;
    })
    .filter(id => !isNaN(id));
  return Math.max(...ids, 0) + 1;
}

/**
 * Adiciona dados a uma aba (alias para appendSheetData)
 */
export async function appendToSheets(sheetName, data) {
  return appendSheetData(sheetName, data);
}

/**
 * Divide um array em chunks
 */
export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Exporta getSheetsClient (função interna, mas necessária para compatibilidade)
 */
export async function getSheetsClient() {
  const auth = await authorize();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Exporta withRetry para compatibilidade
 */
export { withRetry };

