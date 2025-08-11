// pages/api/enriquecer-empresa.js
import { google } from 'googleapis';
import { enrichCompanyData } from '../../lib/perplexity';

const SHEET_NAME = 'layout_importacao_empresas';

// Ordem exata das colunas na planilha:
const HEADERS = [
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

function mapToRow(enriched) {
  // Garantir strings simples sem undefined
  const g = (v) => (v == null ? '' : String(v).trim());

  // Compatibilizar chaves internas da lib com os headers
  return [
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
  return headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function normalizeCNPJ(cnpj) {
  if (!cnpj) return '';
  const digits = String(cnpj).replace(/\D+/g, '');
  if (digits.length !== 14) return '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

async function getRowIndexByCNPJ(sheets, spreadsheetId, headers, cnpj) {
  const cnpjIdx = getColumnIndex(headers, 'CNPJ Empresa');
  if (cnpjIdx < 0) return -1;
  const rows = await getAllRows(sheets, spreadsheetId);
  const fixed = normalizeCNPJ(cnpj);
  if (!fixed) return -1;

  for (let i = 0; i < rows.length; i++) {
    const rowCnpj = normalizeCNPJ(rows[i]?.[cnpjIdx] || '');
    if (rowCnpj && rowCnpj === fixed) {
      // +2 porque rows começa em A2 (linha 2); i=0 => linha 2
      return i + 2;
    }
  }
  return -1;
}

async function upsertCompany(sheets, spreadsheetId, headers, rowValues) {
  // headers devem bater 1:1 com HEADERS
  if (headers.length !== HEADERS.length) {
    throw new Error(`Headers da planilha não batem com o esperado. Esperado: ${HEADERS.join(' | ')}`);
  }

  const cnpjIdx = getColumnIndex(headers, 'CNPJ Empresa');
  const cnpjValue = rowValues[cnpjIdx] || '';
  const rowIndex = await getRowIndexByCNPJ(sheets, spreadsheetId, headers, cnpjValue);

  if (rowIndex > 0) {
    // Update linha existente
    const range = `${SHEET_NAME}!A${rowIndex}:N${rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    });
    return { action: 'updated', rowIndex };
  } else {
    // Append no final
    const range = `${SHEET_NAME}!A:N`;
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
    const { clienteId, nome, estado, cidade } = req.body || {};
    if (!nome) {
      return res.status(400).json({ ok: false, error: 'Nome é obrigatório' });
    }

    // 1) Enriquecer com Perplexity
    const enriched = await enrichCompanyData({ nome, estado, cidade });

    // 2) Mapear para a linha no formato exato da planilha
    const rowValues = mapToRow(enriched);

    // 3) Persistir (upsert) na planilha
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const headers = await getHeaderRow(sheets, spreadsheetId);

    // Validação rápida de cabeçalho (ordem e nomes)
    const mismatch =
      headers.length !== HEADERS.length ||
      headers.some((h, i) => (h || '').trim() !== HEADERS[i]);
    if (mismatch) {
      return res.status(412).json({
        ok: false,
        error: 'Cabeçalho da planilha não corresponde ao esperado para layout_importacao_empresas.',
        expected: HEADERS,
        got: headers,
      });
    }

    const result = await upsertCompany(sheets, spreadsheetId, headers, rowValues);

    return res.status(200).json({ ok: true, data: { enriched, result } });
  } catch (error) {
    console.error('[enriquecer-empresa] fail', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}

