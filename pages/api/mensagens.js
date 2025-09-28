import { getSheetData } from '@/lib/googleSheets';

// Simple in-memory cache
const cache = { time: 0, data: null };
const TTL = 10000; // 10 seconds

function normalizeApp(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

async function fetchMensagens() {
  const { headers, rows } = await getSheetData('Mensagens');

  // Find header names safely, accommodating for variations.
  const lowerHeaders = headers.map(h => (h || '').toLowerCase());
  const tituloHeader = headers[lowerHeaders.indexOf('título')] || headers[lowerHeaders.indexOf('titulo')];
  const appHeader = headers[lowerHeaders.indexOf('aplicativo')];
  const msgHeader = headers[lowerHeaders.indexOf('mensagem')];

  // If essential headers are missing, log an error and return empty.
  if (!tituloHeader || !appHeader || !msgHeader) {
    console.error('Could not find required headers (título/titulo, aplicativo, mensagem) in "Mensagens" sheet.');
    return [];
  }

  return rows
    .map((row) => ({
      titulo: row[tituloHeader] || '',
      aplicativo: normalizeApp(row[appHeader]),
      mensagem: row[msgHeader] || '',
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
