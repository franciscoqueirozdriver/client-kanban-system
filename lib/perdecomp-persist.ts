import 'server-only';

import crypto from 'crypto';
import { Buffer } from 'buffer';

import {
  appendPerdecompFacts,
  upsertPerdecompSnapshot,
  type SheetCell,
} from '@/lib/sheets-perdecomp';
import { getSheetData } from './googleSheets.js';

import type {
  CardPayload,
  CountBlock,
  IdentifiedCode,
  RiskTag,
  SnapshotMetadata,
} from '@/types/perdecomp-card';

export type {
  CardPayload,
  CountBlock,
  IdentifiedCode,
  RiskTag,
  SnapshotMetadata,
};

type Maybe<T> = T | null | undefined;

type Cell = SheetCell;
type Row = Cell[];

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

export type SnapshotResult = {
  card: CardPayload;
  metadata: SnapshotMetadata;
};

const FACTS_SHEET = 'perdecomp_facts';
const SNAPSHOT_SHEET = 'perdecomp_snapshot';

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function splitLargeJson(jsonStr: string, max = 45000) {
  if (jsonStr.length <= max) return { p1: jsonStr, p2: '' };
  return { p1: jsonStr.slice(0, max), p2: jsonStr.slice(max) };
}

export { splitLargeJson as splitLarge };

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
  console.log('[PERDCOMP] savePerdecompResults CALLED', {
    clienteId: args.clienteId,
    facts: args.facts?.length ?? 0,
    risco: args.risco_nivel,
    ultima: args.card?.rendered_at_iso,
  });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }

  const nowISO = new Date().toISOString();
  await appendPerdecompFacts([]);
  const { rows: factRows } = await getSheetData(FACTS_SHEET);
  const existingFactsByKey = new Map<string, any[]>();
  factRows.forEach(row => {
    const key = buildFactKey(row['Cliente_ID'], row['Perdcomp_Numero'], row['Protocolo']);
    if (!existingFactsByKey.has(key)) {
      existingFactsByKey.set(key, []);
    }
    existingFactsByKey.get(key)!.push(row);
  });

  const factRowsToAppend: Row[] = [];
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

    const rowValues: Row = [
      args.clienteId,
      args.empresaId,
      args.nome,
      args.cnpj,
      fact.Perdcomp_Numero,
      fact.Perdcomp_Formatado ?? '',
      fact.B1 ?? '',
      fact.B2 ?? '',
      fact.Data_DDMMAA ?? '',
      fact.Data_ISO ?? '',
      fact.Tipo_Codigo,
      fact.Tipo_Nome,
      fact.Natureza,
      fact.Familia,
      fact.Credito_Codigo ?? '',
      fact.Credito_Descricao ?? '',
      fact.Risco_Nivel ?? '',
      fact.Protocolo ?? '',
      fact.Situacao ?? '',
      fact.Situacao_Detalhamento ?? '',
      fact.Motivo_Normalizado ?? '',
      fact.Solicitante ?? '',
      args.fonte,
      args.dataConsultaISO,
      args.urlComprovanteHTML ?? '',
      rowHash,
      nowISO,
      args.consultaId,
      version,
      false,
    ];
    factRowsToAppend.push(rowValues);
    existing.push({
      Cliente_ID: args.clienteId,
      Perdcomp_Numero: fact.Perdcomp_Numero,
      Protocolo: fact.Protocolo ?? '',
      Row_Hash: rowHash,
      Version: version,
    });
  }

  // --- Handle snapshot sheet ---
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

  const qtdTotal = args.card.quantidade_total ?? args.facts.length ?? 0;
  const snapshotRow: Row = [
    args.clienteId,
    args.empresaId,
    args.nome,
    args.cnpj,
    qtdTotal,
    counts.DCOMP,
    counts.REST,
    counts.RESSARC,
    args.risco_nivel,
    JSON.stringify(args.tags_risco ?? []),
    JSON.stringify(args.por_natureza ?? []),
    JSON.stringify(args.por_credito ?? []),
    JSON.stringify(datas),
    primeiraData,
    ultimaData,
    p1,
    p2,
    args.card.schema_version ?? 0,
    args.card.rendered_at_iso ?? '',
    args.fonte,
    args.dataConsultaISO,
    args.urlComprovanteHTML ?? '',
    payloadBytes,
    nowISO,
    snapshotHash,
    args.facts.length,
    args.consultaId,
    args.erroUltimaConsulta ?? '',
  ];

  console.log('PERDCOMP_PERSIST_START', {
    clienteId: args.clienteId,
    factsCount: factRowsToAppend.length,
    cardCodes: args.card?.codigos_identificados?.length ?? -1,
  });

  await upsertPerdecompSnapshot(snapshotRow);
  console.log('PERDCOMP_SNAPSHOT_OK', { clienteId: args.clienteId });

  if (factRowsToAppend.length) {
    await appendPerdecompFacts(factRowsToAppend);
    console.log('PERDCOMP_FACTS_OK', { clienteId: args.clienteId, appended: factRowsToAppend.length });
  } else {
    console.log('PERDCOMP_FACTS_SKIP_EMPTY', { clienteId: args.clienteId });
  }

  console.log('PERDCOMP_PERSIST_END', { clienteId: args.clienteId });
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

