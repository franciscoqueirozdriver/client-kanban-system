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
const COMPANY_IMPORT_SHEET_NAME = process.env.COMPANY_IMPORT_SHEET_NAME || 'layout_importacao_empresas';

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

export async function appendCompanyImportRow(empresa, spreadsheetId = process.env.SPREADSHEET_ID) {
  const DEBUG = process.env.DEBUG_SHEETS === '1';
  const tag = '[googleSheets.appendCompanyImportRow]';
  const log = (...a) => { if (DEBUG) console.log(tag, ...a); };
  const warn = (...a) => { if (DEBUG) console.warn(tag, ...a); };
  const errlog = (...a) => console.error(tag, ...a);

  function safe(v, max = 120) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  const authEmail = process.env.GOOGLE_CLIENT_EMAIL || '(missing)';
  const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
  const sheetName = process.env.COMPANY_IMPORT_SHEET_NAME || 'layout_importacao_empresas';

  log('env.check', {
    SPREADSHEET_ID: spreadsheetId ? '[present]' : '(missing)',
    GOOGLE_CLIENT_EMAIL: authEmail,
    GOOGLE_PRIVATE_KEY: hasKey ? '[present]' : '(missing)',
    COMPANY_IMPORT_SHEET_NAME: sheetName,
  });

  // --- auth
  let auth;
  try {
    auth = new (require('googleapis').google.auth.JWT)({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();
    log('auth.ok');
  } catch (e) {
    errlog('auth.fail', e?.message || e);
    throw e;
  }

  const sheets = require('googleapis').google.sheets({ version: 'v4', auth });

  // --- header
  let header = [];
  try {
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    header = (headerRes.data?.values?.[0] || []).map(String);
    log('header.ok', { count: header.length, header: header.join(' | ') });
  } catch (e) {
    errlog('header.fail', e?.message || e);
    throw e;
  }

  // --- map
  const map = {
    'Nome da Empresa': empresa.nome || '',
    'Site Empresa': empresa.site || '',
    'País Empresa': empresa.pais || '',
    'Estado Empresa': empresa.estado || '',
    'Cidade Empresa': empresa.cidade || '',
    'Logradouro Empresa': empresa.logradouro || '',
    'Numero Empresa': empresa.numero || '',
    'Bairro Empresa': empresa.bairro || '',
    'Complemento Empresa': empresa.complemento || '',
    'CEP Empresa': empresa.cep || '',
    'CNPJ Empresa': empresa.cnpj || '',
    'DDI Empresa': empresa.ddi || '',
    'Telefones Empresa': (empresa.telefone2
      ? `${empresa.telefone || ''} | ${empresa.telefone2 || ''}`
      : (empresa.telefone || '')),
    'Observação Empresa': empresa.observacao || '',
  };

  // Warn se colunas esperadas não estão no header
  const expected = Object.keys(map);
  const missingInHeader = expected.filter(k => !header.includes(k));
  const extrasInHeader = header.filter(k => !expected.includes(k));
  if (missingInHeader.length) warn('header.missing_columns', missingInHeader);
  if (extrasInHeader.length) log('header.extra_columns', extrasInHeader);

  // --- row assembly
  const row = header.map((col) => (col in map ? String(map[col]) : ''));
  log('row.preview', {
    length: row.length,
    sample: row.slice(0, 8).map(v => safe(v)),
  });

  // --- append
  let appendRes;
  try {
    appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    log('append.ok', {
      status: appendRes.status,
      dataKeys: Object.keys(appendRes.data || {}),
      tableRange: appendRes.data?.tableRange || null,
      updates: appendRes.data?.updates ? Object.keys(appendRes.data.updates) : null,
    });
  } catch (e) {
    errlog('append.fail', {
      message: e?.message,
      code: e?.code,
      status: e?.response?.status,
      data: e?.response?.data,
      stack: e?.stack,
    });
    throw e;
  }

  // --- count rows (best-effort)
  let totalRows = null;
  try {
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });
    totalRows = countRes.data?.values?.length || 0;
    log('count.ok', { totalRows });
  } catch (e) {
    warn('count.fail', e?.message || e);
  }

  return {
    ok: true,
    tableRange: appendRes.data?.tableRange || null,
    totalRows,
  };
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
