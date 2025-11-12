import { google } from 'googleapis';

// Simple in-memory cache
const cache = { time: 0, data: null };
const TTL = 10000; // 10 seconds

function normalizeApp(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

async function fetchMensagens() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'Mensagens',
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  const lower = header.map((h) => h.toLowerCase());
  const tituloIdx = lower.indexOf('título') !== -1 ? lower.indexOf('título') : lower.indexOf('titulo');
  const appIdx = lower.indexOf('aplicativo');
  const msgIdx = lower.indexOf('mensagem');

  return data
    .map((row) => ({
      titulo: row[tituloIdx] || '',
      aplicativo: normalizeApp(row[appIdx]),
      mensagem: row[msgIdx] || '',
    }))
    .filter((m) => m.titulo || m.mensagem);
}

export async function getMensagens() {
  if (cache.data && Date.now() - cache.time < TTL) {
    return cache.data;
  }
  const data = await fetchMensagens();
  cache.time = Date.now();
  cache.data = data;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const appFilter = req.query.app ? normalizeApp(req.query.app) : '';
    const messages = await getMensagens();
    const filtered = appFilter
      ? messages.filter((m) => m.aplicativo === appFilter)
      : messages;
    res.status(200).json({ messages: filtered });
  } catch (err) {
    console.error('Erro ao ler mensagens:', err);
    res.status(500).json({ error: 'Erro ao ler mensagens' });
  }
}
