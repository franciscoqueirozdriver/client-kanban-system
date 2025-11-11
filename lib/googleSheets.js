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
const SHEET_NAME = 'negocios';
const HISTORY_SHEET_NAME = 'historico_interacoes';

const COMPANY_IMPORT_SHEET_NAME = 'importacao_empresas';

// ✅ Mapeamento de colunas para updateRow
const COLUMN_MAP = {
  cliente_id: 'cliente_id',
  cliente: 'negocio_organizacao',
  titulo_negocio: 'negocio_titulo',
  valor_negocio: 'negocio_valor',
  pessoa_contato: 'negocio_pessoa_contato',
  data_fechamento_esperada: 'negocio_data_fechamento_esperada',
  etapa: 'negocio_etapa',
  fonte_lead: 'negocio_fonte_lead',
  data_criacao: 'negocio_data_criacao',
  ganho_em: 'negocio_ganho_em',
  vlr_mensalidade: 'negocio_vlr_mensalidade',
  vlr_implantacao: 'negocio_vlr_implantacao',
  status_kanban: 'status_kanban',
  cor_card: 'cor_card',
  data_ultima_movimentacao: 'data_ultima_movimentacao',
  linkedin_contato: 'pessoa_end_linkedin',
  impresso_lista: 'impresso_lista',
  telefone_normalizado: 'telefone_normalizado',
};

// ✅ Mapeamento de colunas da aba de histórico
const HISTORY_COLUMN_MAP = {
  cliente_id: 'cliente_id',
  data_hora: 'data_hora',
  tipo: 'tipo',
  de_fase: 'de_fase',
  para_fase: 'para_fase',
  canal: 'canal',
  observacao: 'observacao',
  mensagem_usada: 'mensagem_usada',
};

// ✅ Mapeamento para aba de importação de empresas
const COMPANY_COLUMN_MAP = {
  nome: 'nome',
  site: 'site',
  pais: 'pais',
  estado: 'estado',
  cidade: 'cidade',
  logradouro: 'logradouro',
  numero: 'numero',
  bairro: 'bairro',
  complemento: 'complemento',
  cep: 'cep',
  cnpj: 'cnpj',
  ddi: 'ddi',
  telefone: 'telefone',
  telefone2: 'telefone2',
  observacao: 'observacao',
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
  const idx = {
    clienteId: header.indexOf('cliente_id'),
    org: header.indexOf('organizacao_nome'),
    contato: header.indexOf('negocio_pessoa_contato'),
    email: header.indexOf('pessoa_email_work'),
    status: header.indexOf('status_kanban'),
    segmento: header.indexOf('organizacao_segmento'),
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
