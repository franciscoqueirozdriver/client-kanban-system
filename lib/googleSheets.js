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

// ✅ Mapeamento de colunas para updateRow
const COLUMN_MAP = {
  cliente_id: 'Cliente_ID',                       // ✅ Adicionado suporte ao Cliente_ID
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
  impresso_lista: 'Impresso_Lista',               // ✅ Marcar leads impressos
  telefone_normalizado: 'Telefone Normalizado',
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

export async function appendRow(data) {
  const { headers, indexMap } = await getHeaderInfoCached();
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = new Array(headers.length).fill('');
  Object.entries(data).forEach(([key, value]) => {
    const header = COLUMN_MAP[key];
    if (header && indexMap[header] !== undefined) {
      row[indexMap[header]] = value;
    }
  });
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: SHEET_NAME,
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
      requestBody: { values: [[value]] },
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
