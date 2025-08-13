// pages/api/enriquecer-empresa.js
import { google } from 'googleapis';
import { enrichCompanyData } from '../../lib/perplexity.js';

const SHEET_NAME = 'layout_importacao_empresas';

// Normaliza cabeçalhos removendo acentos, espaços extras e case
function normalizeHeader(h) {
  return (h || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Ordem exata das colunas na planilha:
const HEADERS = [
  'Cliente_ID',
  'Nome da Empresa',
  'Site Empresa',
  'País Empresa',
  'Estado Empresa',
  'Cidade Empresa',
  'Logradouro Empresa',
  'Numero Empresa',
  'Bairro Empresa',
  'Complemento Empresa',
  'CEP Empresa',
  'CNPJ Empresa',
  'DDI Empresa',
  'Telefones Empresa',
  'Observação Empresa'
];

// Versões normalizadas para comparações flexíveis
const NORMALIZED_HEADERS = HEADERS.map(normalizeHeader);

function mapToRow(enriched, clienteId) {
  // Garantir strings simples sem undefined
  const g = (v) => (v == null ? '' : String(v).trim());

  // Compatibilizar chaves internas da lib com os headers
  return [
    g(clienteId),
    g(enriched.nome),
    g(enriched.site),
    g(enriched.pais || 'Brasil'),
    g(enriched.estado),
    g(enriched.cidade),
    g(enriched.logradouro),
    g(enriched.numero),
    g(enriched.bairro),
    g(enriched.complemento),
    g(enriched.cep),
    g(enriched.cnpj),
    g(enriched.ddi), // já vem vazio se não há telefone
    g(enriched.telefone || enriched.telefone2 || ''), // 1º telefone disponível
    g(enriched.observacao)
  ];
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

async function getHeaderRow(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`,
  });
  const headers = res.data.values?.[0] || [];
  return headers.map((h) => (h || '').trim());
}

async function getAllRows(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:Z`, // supomos até Z, suficiente para as colunas
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return res.data.values || [];
}

function getColumnIndex(headers, name) {
  const target = normalizeHeader(name);
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

async function getRowIndexByClientId(sheets, spreadsheetId, headers, clientId) {
  const idIdx = getColumnIndex(headers, 'Cliente_ID');
  if (idIdx < 0) return -1;
  const rows = await getAllRows(sheets, spreadsheetId);
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[idIdx] || '').toString() === (clientId || '').toString()) {
      return i + 2; // +2 porque rows começa em A2
    }
  }
  return -1;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'gmail.com.br',
  'hotmail.com',
  'hotmail.com.br',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'yahoo.com',
  'yahoo.com.br',
  'bol.com.br',
  'uol.com.br',
  'icloud.com',
  'msn.com',
  'aol.com',
  'terra.com.br',
]);

function extractDomain(email) {
  const match = String(email || '')
    .toLowerCase()
    .match(/@([^\s@]+)/);
  if (!match) return '';
  const domain = match[1];
  if (FREE_EMAIL_DOMAINS.has(domain)) return '';
  return domain;
}

async function findDomainFromSheet1(sheets, spreadsheetId, clientId) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    if (!rows.length) return '';
    const headers = rows[0];
    const idIdx = headers.indexOf('Cliente_ID');
    if (idIdx < 0) return '';
    const workIdx = headers.indexOf('Pessoa - Email - Work');
    const homeIdx = headers.indexOf('Pessoa - Email - Home');
    const otherIdx = headers.indexOf('Pessoa - Email - Other');
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if ((row[idIdx] || '').toString() !== (clientId || '').toString()) continue;
      const emails = [];
      [workIdx, homeIdx, otherIdx].forEach((idx) => {
        if (idx >= 0 && row[idx]) emails.push(row[idx]);
      });
      for (const email of emails) {
        const domain = extractDomain(email);
        if (domain) return domain;
      }
      break;
    }
  } catch {}
  return '';
}

async function upsertCompany(sheets, spreadsheetId, headers, rowValues, overwrite) {
  // headers devem bater 1:1 com HEADERS (normalizados)
  const normalized = headers.map(normalizeHeader);
  if (
    normalized.length !== NORMALIZED_HEADERS.length ||
    normalized.some((h, i) => h !== NORMALIZED_HEADERS[i])
  ) {
    throw new Error(
      `Headers da planilha não batem com o esperado. Esperado: ${HEADERS.join(' | ')}`
    );
  }

  const idIdx = getColumnIndex(headers, 'Cliente_ID');
  const clientId = rowValues[idIdx] || '';
  const rowIndex = await getRowIndexByClientId(sheets, spreadsheetId, headers, clientId);

  if (rowIndex > 0) {
    if (!overwrite) {
      return { action: 'exists', rowIndex };
    }
    const range = `${SHEET_NAME}!A${rowIndex}:O${rowIndex}`; // 15 colunas => até O
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    });
    return { action: 'updated', rowIndex };
  } else {
    const range = `${SHEET_NAME}!A:O`;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowValues] },
    });
    return { action: 'appended' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { clienteId, nome, estado, cidade, cep, overwrite } = req.body || {};
    if (!nome) {
      return res.status(400).json({ ok: false, error: 'Nome é obrigatório' });
    }

    // 1) Enriquecer com Perplexity
    const enriched = await enrichCompanyData({ nome, estado, cidade, cep });

    // 1.1) Se site ausente, tentar derivar do domínio de e-mail da Sheet1
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!enriched.site && clienteId) {
      const domain = await findDomainFromSheet1(sheets, spreadsheetId, clienteId);
      if (domain) enriched.site = `www.${domain}`;
    }

    // 2) Mapear para a linha no formato exato da planilha
    const rowValues = mapToRow(enriched, clienteId);

    // 3) Persistir (upsert) na planilha
    const headers = await getHeaderRow(sheets, spreadsheetId);

    // Validação rápida de cabeçalho (ordem e nomes, normalizados)
    const normalized = headers.map(normalizeHeader);
    const mismatch =
      normalized.length !== NORMALIZED_HEADERS.length ||
      normalized.some((h, i) => h !== NORMALIZED_HEADERS[i]);
    if (mismatch) {
      return res.status(412).json({
        ok: false,
        error: 'Cabeçalho da planilha não corresponde ao esperado para layout_importacao_empresas.',
        expected: HEADERS,
        got: headers,
      });
    }

    const result = await upsertCompany(sheets, spreadsheetId, headers, rowValues, overwrite);

    if (result.action === 'exists' && !overwrite) {
      return res.status(200).json({ ok: false, exists: true });
    }

    return res.status(200).json({ ok: true, data: { enriched, result } });
  } catch (error) {
    console.error('[enriquecer-empresa] fail', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}

