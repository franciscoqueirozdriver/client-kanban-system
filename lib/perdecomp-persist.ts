import 'server-only';

import crypto from 'crypto';
import { Buffer } from 'buffer';

import { getSheetData, getSheetsClient, withRetry } from './googleSheets.js';

type Maybe<T> = T | null | undefined;

export type IdentifiedCode = {
  codigo: string;
  risco: string;
  credito_tipo: string;
  grupo: string;
  natureza: string;
  protocolo?: string;
  situacao?: string;
  situacao_detalhamento?: string;
  data_iso?: string;
};

export type RiskTag = { label: string; count: number };
export type CountBlock = { label: string; count: number };

export type CardPayload = {
  header: { nome: string; cnpj: string; ultima_consulta_iso: string };
  quantidade_total: number;
  analise_risco: { nivel: string; tags: RiskTag[] };
  quantos_sao: CountBlock[];
  por_natureza: CountBlock[];
  por_credito: CountBlock[];
  codigos_identificados: IdentifiedCode[];
  recomendacoes: string[];
  links?: { cancelamentos?: string; html?: string };
  schema_version: number;
  rendered_at_iso: string;
};

export type SaveArgs = {
  clienteId: string;
  empresaId: string;
  nome: string;
  cnpj: string;
  consultaId: string;
  fonte: string;
  dataConsultaISO: string;
  urlComprovanteHTML?: string;
  facts: Array<{
    Perdcomp_Numero: string;
    Perdcomp_Formatado?: string;
    B1?: string;
    B2?: string;
    Data_DDMMAA?: string;
    Data_ISO?: string;
    Tipo_Codigo: string;
    Tipo_Nome: string;
    Natureza: string;
    Familia: string;
    Credito_Codigo?: string;
    Credito_Descricao?: string;
    Risco_Nivel?: string;
    Protocolo?: string;
    Situacao?: string;
    Situacao_Detalhamento?: string;
    Motivo_Normalizado?: string;
    Solicitante?: string;
  }>;
  card: CardPayload;
  risco_nivel: string;
  tags_risco: RiskTag[];
  por_natureza: CountBlock[];
  por_credito: CountBlock[];
  erroUltimaConsulta?: string;
};

export type SnapshotMetadata = {
  clienteId: string;
  empresaId: string;
  nome: string;
  cnpj: string;
  riscoNivel: string;
  tagsRisco: RiskTag[];
  porNatureza: CountBlock[];
  porCredito: CountBlock[];
  datas: string[];
  primeiraDataISO: string;
  ultimaDataISO: string;
  renderedAtISO: string;
  cardSchemaVersion: number;
  fonte: string;
  dataConsulta: string;
  urlComprovanteHTML: string;
  payloadBytes: number;
  lastUpdatedISO: string;
  snapshotHash: string;
  factsCount: number;
  consultaId: string;
  erroUltimaConsulta: string;
  qtdTotal: number;
  qtdDcomp: number;
  qtdRest: number;
  qtdRessarc: number;
};

export type SnapshotResult = {
  card: CardPayload;
  metadata: SnapshotMetadata;
};

const FACTS_SHEET = 'perdecomp_facts';
const SNAPSHOT_SHEET = 'perdecomp_snapshot';

const FACTS_HEADERS = [
  'Cliente_ID',
  'Empresa_ID',
  'Nome da Empresa',
  'CNPJ',
  'Perdcomp_Numero',
  'Perdcomp_Formatado',
  'B1',
  'B2',
  'Data_DDMMAA',
  'Data_ISO',
  'Tipo_Codigo',
  'Tipo_Nome',
  'Natureza',
  'Familia',
  'Credito_Codigo',
  'Credito_Descricao',
  'Risco_Nivel',
  'Protocolo',
  'Situacao',
  'Situacao_Detalhamento',
  'Motivo_Normalizado',
  'Solicitante',
  'Fonte',
  'Data_Consulta',
  'URL_Comprovante_HTML',
  'Row_Hash',
  'Inserted_At',
  'Consulta_ID',
  'Version',
  'Deleted_Flag',
];

const SNAPSHOT_HEADERS = [
  'Cliente_ID',
  'Empresa_ID',
  'Nome da Empresa',
  'CNPJ',
  'Qtd_Total',
  'Qtd_DCOMP',
  'Qtd_REST',
  'Qtd_RESSARC',
  'Risco_Nivel',
  'Risco_Tags_JSON',
  'Por_Natureza_JSON',
  'Por_Credito_JSON',
  'Datas_JSON',
  'Primeira_Data_ISO',
  'Ultima_Data_ISO',
  'Resumo_Ultima_Consulta_JSON_P1',
  'Resumo_Ultima_Consulta_JSON_P2',
  'Card_Schema_Version',
  'Rendered_At_ISO',
  'Fonte',
  'Data_Consulta',
  'URL_Comprovante_HTML',
  'Payload_Bytes',
  'Last_Updated_ISO',
  'Snapshot_Hash',
  'Facts_Count',
  'Consulta_ID',
  'Erro_Ultima_Consulta',
];

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function splitLargeJson(jsonStr: string, max = 45000) {
  if (jsonStr.length <= max) return { p1: jsonStr, p2: '' };
  return { p1: jsonStr.slice(0, max), p2: jsonStr.slice(max) };
}

export function joinLargeJson(p1?: string, p2?: string) {
  return (p1 || '') + (p2 || '');
}

export function uniqueSortedDatesISO(dates: (string | undefined)[]) {
  const set = new Set(dates.filter(Boolean) as string[]);
  return Array.from(set).sort().reverse();
}

export function minDateISO(dates: string[]) {
  if (!dates.length) return '';
  return dates.reduce((a, b) => (a < b ? a : b));
}

export function maxDateISO(dates: string[]) {
  if (!dates.length) return '';
  return dates.reduce((a, b) => (a > b ? a : b));
}

function columnNumberToLetter(columnNumber: number) {
  let temp: number;
  let letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

async function ensureHeaders(sheetName: string, requiredHeaders: string[]) {
  const sheets = await getSheetsClient();
  const { headers, rows } = await getSheetData(sheetName);
  let finalHeaders = headers && headers.length ? [...headers] : [];
  if (!finalHeaders.length) {
    finalHeaders = [...requiredHeaders];
  } else {
    for (const h of requiredHeaders) {
      if (!finalHeaders.includes(h)) {
        finalHeaders.push(h);
      }
    }
  }

  const headersChanged =
    finalHeaders.length !== headers.length || finalHeaders.some((h, i) => h !== headers[i]);

  if (headersChanged) {
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [finalHeaders] },
      }),
    );
  }

  return { headers: finalHeaders, rows };
}

function buildFactKey(clienteId: string, numero?: Maybe<string>, protocolo?: Maybe<string>) {
  const normalizedNumero = (numero || '').trim();
  const normalizedProtocolo = (protocolo || '').trim();
  return `${clienteId}#${normalizedNumero}#${normalizedProtocolo}`;
}

function classifyFamilia(fact: SaveArgs['facts'][number]) {
  const familia = (fact.Familia || '').toUpperCase();
  if (familia.includes('RESSARC')) return 'RESSARC';
  if (familia.includes('REST')) return 'REST';
  if (familia.includes('DCOMP')) return 'DCOMP';

  const natureza = (fact.Natureza || '').toLowerCase();
  if (natureza.includes('ressarc')) return 'RESSARC';
  if (natureza.includes('restit')) return 'REST';
  if (natureza.includes('compens')) return 'DCOMP';

  return '';
}

export async function savePerdecompResults(args: SaveArgs) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }

  const nowISO = new Date().toISOString();
  const sheets = await getSheetsClient();

  // --- Handle facts sheet ---
  const { headers: factHeaders, rows: factRows } = await ensureHeaders(FACTS_SHEET, FACTS_HEADERS);
  const existingFactsByKey = new Map<string, any[]>();
  factRows.forEach(row => {
    const key = buildFactKey(row['Cliente_ID'], row['Perdcomp_Numero'], row['Protocolo']);
    if (!existingFactsByKey.has(key)) {
      existingFactsByKey.set(key, []);
    }
    existingFactsByKey.get(key)!.push(row);
  });

  const factRowsToAppend: string[][] = [];
  for (const fact of args.facts) {
    const factKey = buildFactKey(args.clienteId, fact.Perdcomp_Numero, fact.Protocolo);
    let existing = existingFactsByKey.get(factKey);
    if (!existing) {
      existing = [];
      existingFactsByKey.set(factKey, existing);
    }
    const hashPayload = { ...fact, Cliente_ID: args.clienteId };
    const rowHash = sha256(JSON.stringify(hashPayload));

    let latest: any | null = null;
    let maxVersion = 0;
    for (const row of existing) {
      const version = Number(row['Version'] ?? 0) || 0;
      if (!latest || version >= maxVersion) {
        latest = row;
        maxVersion = version;
      }
    }

    if (latest && latest['Row_Hash'] === rowHash) {
      continue;
    }

    const version = maxVersion + 1 || 1;

    const sheetRow: Record<string, any> = {};
    factHeaders.forEach(header => {
      sheetRow[header] = '';
    });

    sheetRow['Cliente_ID'] = args.clienteId;
    sheetRow['Empresa_ID'] = args.empresaId;
    sheetRow['Nome da Empresa'] = args.nome;
    sheetRow['CNPJ'] = args.cnpj;
    sheetRow['Perdcomp_Numero'] = fact.Perdcomp_Numero;
    sheetRow['Perdcomp_Formatado'] = fact.Perdcomp_Formatado ?? '';
    sheetRow['B1'] = fact.B1 ?? '';
    sheetRow['B2'] = fact.B2 ?? '';
    sheetRow['Data_DDMMAA'] = fact.Data_DDMMAA ?? '';
    sheetRow['Data_ISO'] = fact.Data_ISO ?? '';
    sheetRow['Tipo_Codigo'] = fact.Tipo_Codigo;
    sheetRow['Tipo_Nome'] = fact.Tipo_Nome;
    sheetRow['Natureza'] = fact.Natureza;
    sheetRow['Familia'] = fact.Familia;
    sheetRow['Credito_Codigo'] = fact.Credito_Codigo ?? '';
    sheetRow['Credito_Descricao'] = fact.Credito_Descricao ?? '';
    sheetRow['Risco_Nivel'] = fact.Risco_Nivel ?? '';
    sheetRow['Protocolo'] = fact.Protocolo ?? '';
    sheetRow['Situacao'] = fact.Situacao ?? '';
    sheetRow['Situacao_Detalhamento'] = fact.Situacao_Detalhamento ?? '';
    sheetRow['Motivo_Normalizado'] = fact.Motivo_Normalizado ?? '';
    sheetRow['Solicitante'] = fact.Solicitante ?? '';
    sheetRow['Fonte'] = args.fonte;
    sheetRow['Data_Consulta'] = args.dataConsultaISO;
    sheetRow['URL_Comprovante_HTML'] = args.urlComprovanteHTML ?? '';
    sheetRow['Row_Hash'] = rowHash;
    sheetRow['Inserted_At'] = nowISO;
    sheetRow['Consulta_ID'] = args.consultaId;
    sheetRow['Version'] = String(version);
    sheetRow['Deleted_Flag'] = 'FALSE';

    const rowValues = factHeaders.map(header => sheetRow[header] ?? '');
    factRowsToAppend.push(rowValues);
    existing.push({ ...sheetRow });
  }

  if (factRowsToAppend.length > 0) {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: FACTS_SHEET,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: factRowsToAppend },
      }),
    );
  }

  // --- Handle snapshot sheet ---
  const { headers: snapshotHeaders, rows: snapshotRows } = await ensureHeaders(
    SNAPSHOT_SHEET,
    SNAPSHOT_HEADERS,
  );

  const datas = uniqueSortedDatesISO(args.facts.map(f => f.Data_ISO));
  const primeiraData = minDateISO(datas);
  const ultimaData = maxDateISO(datas);
  const payloadStr = JSON.stringify(args.card);
  const { p1, p2 } = splitLargeJson(payloadStr);
  const payloadBytes = Buffer.byteLength(payloadStr, 'utf8');
  const snapshotHash = sha256(payloadStr);

  const counts = args.facts.reduce(
    (acc, fact) => {
      const familia = classifyFamilia(fact);
      if (familia && acc[familia] !== undefined) {
        acc[familia as 'DCOMP' | 'REST' | 'RESSARC'] += 1;
      }
      return acc;
    },
    { DCOMP: 0, REST: 0, RESSARC: 0 } as { DCOMP: number; REST: number; RESSARC: number },
  );

  const snapshotRow: Record<string, any> = {};
  snapshotHeaders.forEach(header => {
    snapshotRow[header] = '';
  });

  snapshotRow['Cliente_ID'] = args.clienteId;
  snapshotRow['Empresa_ID'] = args.empresaId;
  snapshotRow['Nome da Empresa'] = args.nome;
  snapshotRow['CNPJ'] = args.cnpj;
  snapshotRow['Qtd_Total'] = String(args.card.quantidade_total ?? args.facts.length ?? 0);
  snapshotRow['Qtd_DCOMP'] = String(counts.DCOMP);
  snapshotRow['Qtd_REST'] = String(counts.REST);
  snapshotRow['Qtd_RESSARC'] = String(counts.RESSARC);
  snapshotRow['Risco_Nivel'] = args.risco_nivel;
  snapshotRow['Risco_Tags_JSON'] = JSON.stringify(args.tags_risco ?? []);
  snapshotRow['Por_Natureza_JSON'] = JSON.stringify(args.por_natureza ?? []);
  snapshotRow['Por_Credito_JSON'] = JSON.stringify(args.por_credito ?? []);
  snapshotRow['Datas_JSON'] = JSON.stringify(datas);
  snapshotRow['Primeira_Data_ISO'] = primeiraData;
  snapshotRow['Ultima_Data_ISO'] = ultimaData;
  snapshotRow['Resumo_Ultima_Consulta_JSON_P1'] = p1;
  snapshotRow['Resumo_Ultima_Consulta_JSON_P2'] = p2;
  snapshotRow['Card_Schema_Version'] = String(args.card.schema_version ?? '');
  snapshotRow['Rendered_At_ISO'] = args.card.rendered_at_iso ?? '';
  snapshotRow['Fonte'] = args.fonte;
  snapshotRow['Data_Consulta'] = args.dataConsultaISO;
  snapshotRow['URL_Comprovante_HTML'] = args.urlComprovanteHTML ?? '';
  snapshotRow['Payload_Bytes'] = String(payloadBytes);
  snapshotRow['Last_Updated_ISO'] = nowISO;
  snapshotRow['Snapshot_Hash'] = snapshotHash;
  snapshotRow['Facts_Count'] = String(args.facts.length);
  snapshotRow['Consulta_ID'] = args.consultaId;
  snapshotRow['Erro_Ultima_Consulta'] = args.erroUltimaConsulta ?? '';

  const snapshotValues = snapshotHeaders.map(header => snapshotRow[header] ?? '');
  const existingSnapshotRow = snapshotRows.find(row => row['Cliente_ID'] === args.clienteId);

  if (existingSnapshotRow) {
    const rowNumber = existingSnapshotRow._rowNumber;
    const lastColumn = columnNumberToLetter(snapshotHeaders.length);
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SNAPSHOT_SHEET}!A${rowNumber}:${lastColumn}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [snapshotValues] },
      }),
    );
  } else {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: SNAPSHOT_SHEET,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [snapshotValues] },
      }),
    );
  }
}

function parseJson<T>(input: string | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export async function loadPerdecompSnapshot(clienteId: string): Promise<SnapshotResult | null> {
  if (!clienteId) return null;
  const { rows } = await getSheetData(SNAPSHOT_SHEET);
  const row = rows.find(r => r['Cliente_ID'] === clienteId);
  if (!row) return null;

  const payloadStr = joinLargeJson(
    row['Resumo_Ultima_Consulta_JSON_P1'],
    row['Resumo_Ultima_Consulta_JSON_P2'],
  );
  if (!payloadStr) return null;

  let card: CardPayload;
  try {
    card = JSON.parse(payloadStr) as CardPayload;
  } catch (error) {
    console.error('[perdecomp_snapshot] Falha ao parsear payload JSON', error);
    return null;
  }

  const tags = parseJson<RiskTag[]>(row['Risco_Tags_JSON'], []);
  const porNatureza = parseJson<CountBlock[]>(row['Por_Natureza_JSON'], []);
  const porCredito = parseJson<CountBlock[]>(row['Por_Credito_JSON'], []);
  const datas = parseJson<string[]>(row['Datas_JSON'], []);

  const metadata: SnapshotMetadata = {
    clienteId: row['Cliente_ID'] || '',
    empresaId: row['Empresa_ID'] || '',
    nome: row['Nome da Empresa'] || '',
    cnpj: row['CNPJ'] || '',
    riscoNivel: row['Risco_Nivel'] || '',
    tagsRisco: tags,
    porNatureza,
    porCredito,
    datas,
    primeiraDataISO: row['Primeira_Data_ISO'] || '',
    ultimaDataISO: row['Ultima_Data_ISO'] || '',
    renderedAtISO: row['Rendered_At_ISO'] || card.rendered_at_iso || '',
    cardSchemaVersion: Number(row['Card_Schema_Version'] || card.schema_version || 0) || 0,
    fonte: row['Fonte'] || '',
    dataConsulta: row['Data_Consulta'] || '',
    urlComprovanteHTML: row['URL_Comprovante_HTML'] || '',
    payloadBytes: Number(row['Payload_Bytes'] || 0) || 0,
    lastUpdatedISO: row['Last_Updated_ISO'] || '',
    snapshotHash: row['Snapshot_Hash'] || '',
    factsCount: Number(row['Facts_Count'] || 0) || 0,
    consultaId: row['Consulta_ID'] || '',
    erroUltimaConsulta: row['Erro_Ultima_Consulta'] || '',
    qtdTotal: Number(row['Qtd_Total'] || 0) || 0,
    qtdDcomp: Number(row['Qtd_DCOMP'] || 0) || 0,
    qtdRest: Number(row['Qtd_REST'] || 0) || 0,
    qtdRessarc: Number(row['Qtd_RESSARC'] || 0) || 0,
  };

  return { card, metadata };
}

