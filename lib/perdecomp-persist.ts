import crypto from 'crypto';

import {
  chunk,
  getSheetData,
  getSheetsClient,
  withRetry,
} from './googleSheets.js';
import { analisarPortfolioPerdcomp } from '@/lib/perdcomp';
import { classificaFamiliaPorNatureza } from '@/utils/perdcomp';

const SNAPSHOT_SHEET = 'perdecomp_snapshot';
const FACTS_SHEET = 'perdecomp_facts';
const PAYLOAD_SHARD_LIMIT = 45000;
const CARD_SCHEMA_VERSION_FALLBACK = 'v1.0.0';
export const CLT_ID_RE = /^CLT-\d{4,}$/;

type ResolveOpts = { providedClienteId?: string | null; cnpj?: string | null };

let nextClienteSequence: number | null = null;
let resolveOverride: ((opts: ResolveOpts) => Promise<string>) | null = null;

type SaveArgs = {
  clienteId: string;
  empresaId?: string;
  cnpj?: string;
  card: any;
  facts: any[];
  meta: {
    fonte?: string;
    dataConsultaISO?: string;
    urlComprovante?: string;
    cardSchemaVersion?: string;
    renderedAtISO?: string;
    consultaId: string;
  };
};

type LoadArgs = {
  clienteId: string;
};

type SnapshotRow = Record<string, string>;

const FACT_METADATA_FIELDS = new Set([
  'Row_Hash',
  'Consulta_ID',
  'Inserted_At',
]);

function normalizeDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D+/g, '');
}

async function findClienteIdByCnpj(cnpj: string | null | undefined): Promise<string | null> {
  const normalized = normalizeDigits(cnpj || '');
  if (!normalized) return null;
  const { rows } = await getSheetData(SNAPSHOT_SHEET);
  const match = rows.find(row => normalizeDigits(toStringValue(row.CNPJ)) === normalized);
  if (!match) return null;
  const id = toStringValue(match.Cliente_ID);
  return CLT_ID_RE.test(id) ? id : null;
}

async function nextClienteId(): Promise<string> {
  if (nextClienteSequence === null) {
    const { rows } = await getSheetData(SNAPSHOT_SHEET);
    let max = 0;
    for (const row of rows) {
      const id = toStringValue(row.Cliente_ID);
      const match = id.match(/^CLT-(\d{4,})$/);
      if (!match) continue;
      const value = Number(match[1]);
      if (!Number.isNaN(value) && value > max) {
        max = value;
      }
    }
    nextClienteSequence = max + 1;
  } else {
    nextClienteSequence += 1;
  }
  const next = nextClienteSequence;
  return `CLT-${String(next).padStart(4, '0')}`;
}

export async function resolveClienteId({ providedClienteId, cnpj }: ResolveOpts): Promise<string> {
  if (providedClienteId && CLT_ID_RE.test(providedClienteId)) {
    const match = providedClienteId.match(/^CLT-(\d{4,})$/);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        nextClienteSequence = Math.max(nextClienteSequence ?? value, value);
      }
    }
    return providedClienteId;
  }

  const found = await findClienteIdByCnpj(cnpj);
  if (found && CLT_ID_RE.test(found)) {
    const match = found.match(/^CLT-(\d{4,})$/);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        nextClienteSequence = Math.max(nextClienteSequence ?? value, value);
      }
    }
    return found;
  }

  return nextClienteId();
}

function columnNumberToLetter(columnNumber: number): string {
  let temp: number;
  let letter = '';
  let num = columnNumber;
  while (num > 0) {
    temp = (num - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    num = (num - temp - 1) / 26;
  }
  return letter;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function pickCardString(card: any, key: string): string {
  if (!card) return '';
  if (typeof card[key] === 'string') return card[key];
  if (typeof card[key] === 'number' || typeof card[key] === 'boolean') {
    return String(card[key]);
  }
  return '';
}

function aggregateByKey(facts: any[], keys: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fact of facts ?? []) {
    for (const key of keys) {
      const value = fact?.[key];
      if (!value) continue;
      const normalized = toStringValue(value).trim();
      if (!normalized) continue;
      counts[normalized] = (counts[normalized] || 0) + 1;
      break;
    }
  }
  return counts;
}

function aggregateFamilias(facts: any[]): Record<string, number> {
  const counters: Record<string, number> = {
    DCOMP: 0,
    REST: 0,
    RESSARC: 0,
    CANC: 0,
  };
  for (const fact of facts ?? []) {
    const familia = toStringValue(
      fact?.Familia ||
        fact?.familia ||
        classificaFamiliaPorNatureza(toStringValue(fact?.Natureza || fact?.natureza)),
    ).toUpperCase();
    if (familia && counters[familia] !== undefined) {
      counters[familia] += 1;
    }
  }
  return counters;
}

function collectDates(facts: any[], meta: SaveArgs['meta']): string[] {
  const set = new Set<string>();
  const push = (value: string) => {
    const match = value?.match?.(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      set.add(match[1]);
    }
  };
  if (meta?.dataConsultaISO) push(meta.dataConsultaISO);
  for (const fact of facts ?? []) {
    if (!fact) continue;
    Object.values(fact).forEach(value => {
      if (typeof value === 'string') push(value);
    });
  }
  return Array.from(set).sort();
}

function computeSnapshotRow({
  clienteId,
  empresaId,
  cnpj,
  card,
  facts,
  meta,
  nowISO,
}: SaveArgs & { nowISO: string }): SnapshotRow {
  const resumo = card?.perdcompResumo || {};
  const porFamilia = resumo?.porFamilia || {};
  const porNatureza = resumo?.porNaturezaAgrupada || aggregateByKey(facts, ['Natureza', 'natureza']);
  const porCredito = (() => {
    const cardCodigos: string[] = Array.isArray(card?.perdcompCodigos)
      ? card.perdcompCodigos.filter((c: any) => typeof c === 'string')
      : [];
    if (cardCodigos.length) {
      const analysis = analisarPortfolioPerdcomp(cardCodigos);
      return analysis.distribuicaoPorCredito;
    }
    return aggregateByKey(facts, ['Credito', 'credito']);
  })();

  const riskAnalysis = (() => {
    const cardCodigos: string[] = Array.isArray(card?.perdcompCodigos)
      ? card.perdcompCodigos.filter((c: any) => typeof c === 'string')
      : [];
    if (!cardCodigos.length) return null;
    return analisarPortfolioPerdcomp(cardCodigos);
  })();

  const datas = collectDates(facts, meta);
  const payloadString = JSON.stringify(card ?? {});
  const shardP1 = payloadString.slice(0, PAYLOAD_SHARD_LIMIT);
  const shardP2 = payloadString.length > PAYLOAD_SHARD_LIMIT ? payloadString.slice(PAYLOAD_SHARD_LIMIT) : '';
  const snapshotHash = crypto.createHash('sha256').update(shardP1 + shardP2).digest('hex');
  const payloadBytes = Buffer.byteLength(payloadString, 'utf8');

  const familiasFallback = aggregateFamilias(facts);

  return {
    Cliente_ID: clienteId,
    Empresa_ID: empresaId ?? '',
    'Nome da Empresa':
      pickCardString(card, 'nomeEmpresa') ||
      pickCardString(card, 'Nome_da_Empresa') ||
      pickCardString(card, 'Nome da Empresa'),
    CNPJ:
      (
        cnpj ??
        (pickCardString(card, 'cnpj') ||
          pickCardString(card, 'CNPJ') ||
          pickCardString(card, 'CNPJ_Empresa'))
      ) || '',
    Qtd_Total: String(resumo?.total ?? facts?.length ?? 0),
    Qtd_DCOMP: String(porFamilia?.DCOMP ?? familiasFallback.DCOMP ?? 0),
    Qtd_REST: String(porFamilia?.REST ?? familiasFallback.REST ?? 0),
    Qtd_RESSARC: String(porFamilia?.RESSARC ?? familiasFallback.RESSARC ?? 0),
    Risco_Nivel: riskAnalysis?.nivelRiscoGeral ?? '',
    Risco_Tags_JSON: riskAnalysis ? JSON.stringify(riskAnalysis) : '',
    Por_Natureza_JSON: Object.keys(porNatureza || {}).length ? JSON.stringify(porNatureza) : '',
    Por_Credito_JSON: Object.keys(porCredito || {}).length ? JSON.stringify(porCredito) : '',
    Datas_JSON: datas.length ? JSON.stringify(datas) : '',
    Primeira_Data_ISO: datas[0] ?? '',
    Ultima_Data_ISO: datas[datas.length - 1] ?? '',
    Resumo_Ultima_Consulta_JSON_P1: shardP1,
    Resumo_Ultima_Consulta_JSON_P2: shardP2,
    Card_Schema_Version: meta?.cardSchemaVersion || CARD_SCHEMA_VERSION_FALLBACK,
    Rendered_At_ISO: meta?.renderedAtISO || nowISO,
    Fonte: meta?.fonte || '',
    Data_Consulta: meta?.dataConsultaISO || '',
    URL_Comprovante_HTML: meta?.urlComprovante || pickCardString(card, 'site_receipt'),
    Payload_Bytes: String(payloadBytes),
    Last_Updated_ISO: nowISO,
    Snapshot_Hash: snapshotHash,
    Facts_Count: String(facts?.length ?? 0),
    Consulta_ID: meta?.consultaId || '',
    Erro_Ultima_Consulta: '',
  } as SnapshotRow;
}

function computeFactHash(fact: Record<string, any>): string {
  const numeroOuProtocolo =
    toStringValue(
      fact.Perdcomp_Numero ||
        fact.perdcomp ||
        fact.Perdcomp ||
        fact.Protocolo ||
        fact.protocolo ||
        '',
    ) || '';
  const tipo =
    toStringValue(fact.Tipo || fact.tipo || fact.Tipo_Documento || fact.tipo_documento || '') || '';
  const natureza = toStringValue(fact.Natureza || fact.natureza || '') || '';
  const credito =
    toStringValue(fact.Credito || fact.credito || fact.Tipo_Credito || fact.tipo_credito || '') || '';
  const dataISO =
    toStringValue(
      fact.Data_ISO ||
        fact.data_iso ||
        fact.Data_Protocolo ||
        fact.data_protocolo ||
        fact.Data_Transmissao ||
        fact.data_transmissao ||
        '',
    ) || '';
  const valor = toStringValue(fact.Valor || fact.valor || fact.Valor_Total || fact.valor_total || '') || '';

  const baseParts = [numeroOuProtocolo, tipo, natureza, credito, dataISO, valor];
  if (baseParts.some(part => part)) {
    return crypto.createHash('sha256').update(baseParts.join('|')).digest('hex');
  }

  const fallback = JSON.stringify(
    Object.keys(fact)
      .filter(key => !FACT_METADATA_FIELDS.has(key))
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = fact[key];
        return acc;
      }, {}),
  );
  return crypto.createHash('sha256').update(fallback).digest('hex');
}

function ensureFactBase(
  fact: any,
  {
    clienteId,
    empresaId,
    cnpj,
    meta,
    nowISO,
  }: { clienteId: string; empresaId?: string; cnpj?: string; meta: SaveArgs['meta']; nowISO: string },
) {
  const normalized: Record<string, any> = { ...fact };
  normalized.Cliente_ID = clienteId;
  normalized.Empresa_ID = normalized.Empresa_ID || empresaId || '';
  normalized.CNPJ = normalized.CNPJ || cnpj || '';
  const numero = toStringValue(
    normalized.Perdcomp_Numero || normalized.perdcomp || normalized.Perdcomp || '',
  );
  if (numero) {
    normalized.Perdcomp_Numero = numero;
  }
  if (!normalized.Protocolo && typeof numero === 'string' && numero.length) {
    const protoMatch = numero.match(/-(\d{4})$/);
    if (protoMatch) {
      normalized.Protocolo = protoMatch[1];
    }
  }
  normalized.Data_Consulta = normalized.Data_Consulta || meta?.dataConsultaISO || '';
  normalized.Fonte = normalized.Fonte || meta?.fonte || '';
  normalized.Consulta_ID = meta?.consultaId || '';
  normalized.Inserted_At = nowISO;
  normalized.Row_Hash = computeFactHash(normalized);
  return normalized;
}

async function upsertSnapshot(row: SnapshotRow) {
  const { headers, rows } = await getSheetData(SNAPSHOT_SHEET);
  const sheets = await getSheetsClient();
  const existing = rows.find(r => toStringValue(r.Cliente_ID) === row.Cliente_ID);

  if (!headers.length) {
    throw new Error(`Sheet ${SNAPSHOT_SHEET} is missing headers`);
  }

  if (existing) {
    const merged: Record<string, string> = {};
    headers.forEach(header => {
      if (!header) return;
      if (row[header] !== undefined) {
        merged[header] = row[header];
      } else if (existing[header] !== undefined) {
        merged[header] = toStringValue(existing[header]);
      } else {
        merged[header] = '';
      }
    });

    const updates = headers
      .map((header, index) => {
        if (!header) return null;
        const colLetter = columnNumberToLetter(index + 1);
        return {
          range: `${SNAPSHOT_SHEET}!${colLetter}${existing._rowNumber}`,
          values: [[merged[header] ?? '']],
        };
      })
      .filter(Boolean) as Array<{ range: string; values: string[][] }>;

    if (updates.length) {
      await withRetry(() =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates,
          },
        }),
      );
    }
  } else {
    const values = headers.map(header => row[header] ?? '');
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: SNAPSHOT_SHEET,
        valueInputOption: 'RAW',
        requestBody: {
          values: [values],
        },
      }),
    );
  }
}

async function appendFacts({
  clienteId,
  empresaId,
  cnpj,
  facts,
  meta,
  nowISO,
}: SaveArgs & { nowISO: string }) {
  if (!facts?.length) {
    return { inserted: 0, skipped: 0 };
  }

  const { headers, rows } = await getSheetData(FACTS_SHEET);
  const sheets = await getSheetsClient();

  const existingKeys = new Set(
    rows
      .filter(row => toStringValue(row.Cliente_ID) === clienteId)
      .map(row => {
        const numero = toStringValue(row.Perdcomp_Numero || row.Protocolo || '');
        const hash = toStringValue(row.Row_Hash || '');
        return `${numero}#${hash}`;
      }),
  );

  let inserted = 0;
  let skipped = 0;
  const rowsToAppend: string[][] = [];

  for (const fact of facts) {
    const normalized = ensureFactBase(fact, { clienteId, empresaId, cnpj, meta, nowISO });
    const numero = toStringValue(normalized.Perdcomp_Numero || normalized.Protocolo || '');
    const key = `${numero}#${normalized.Row_Hash}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    inserted += 1;
    const rowValues = headers.map(header => toStringValue(normalized[header] ?? ''));
    rowsToAppend.push(rowValues);
  }

  if (rowsToAppend.length) {
    const batches = chunk(rowsToAppend, 500);
    for (const batch of batches) {
      await withRetry(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: FACTS_SHEET,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: batch,
          },
        }),
      );
    }
  }

  return { inserted, skipped };
}

async function markSnapshotError(clienteId: string, message: string, nowISO: string) {
  try {
    const { headers, rows } = await getSheetData(SNAPSHOT_SHEET);
    const sheets = await getSheetsClient();
    const existing = rows.find(row => toStringValue(row.Cliente_ID) === clienteId);

    const errorIdx = headers.indexOf('Erro_Ultima_Consulta');
    const lastUpdatedIdx = headers.indexOf('Last_Updated_ISO');

    if (existing && errorIdx !== -1) {
      const updates: Array<{ range: string; values: string[][] }> = [];
      const errorLetter = columnNumberToLetter(errorIdx + 1);
      updates.push({
        range: `${SNAPSHOT_SHEET}!${errorLetter}${existing._rowNumber}`,
        values: [[message]],
      });
      if (lastUpdatedIdx !== -1) {
        const lastLetter = columnNumberToLetter(lastUpdatedIdx + 1);
        updates.push({
          range: `${SNAPSHOT_SHEET}!${lastLetter}${existing._rowNumber}`,
          values: [[nowISO]],
        });
      }
      await withRetry(() =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates,
          },
        }),
      );
      return;
    }

    if (!headers.length || errorIdx === -1) {
      return;
    }

    const values = headers.map(header => {
      if (header === 'Cliente_ID') return clienteId;
      if (header === 'Erro_Ultima_Consulta') return message;
      if (header === 'Last_Updated_ISO') return nowISO;
      return '';
    });
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: SNAPSHOT_SHEET,
        valueInputOption: 'RAW',
        requestBody: {
          values: [values],
        },
      }),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL_MARK_ERROR', { clienteId, message: msg });
  }
}

export async function savePerdecompResults(args: SaveArgs): Promise<void> {
  const { card, meta } = args;
  if (!meta?.consultaId) {
    throw new Error('meta.consultaId is required');
  }

  const nowISO = new Date().toISOString();
  const resolvedCnpj =
    args.cnpj ||
    pickCardString(card, 'CNPJ') ||
    pickCardString(card, 'CNPJ_Empresa') ||
    pickCardString(card, 'cnpj') ||
    '';

  const resolver = resolveOverride ?? resolveClienteId;
  const clienteIdFinal = await resolver({
    providedClienteId: args.clienteId,
    cnpj: resolvedCnpj || null,
  });

  if (!CLT_ID_RE.test(clienteIdFinal)) {
    console.warn('PERSIST_ABORT_INVALID_CLIENTE_ID', {
      provided: args.clienteId,
      resolved: clienteIdFinal,
      cnpj: args.cnpj,
    });
    throw new Error('Invalid Cliente_ID for persistence');
  }

  console.info('PERSIST_START', { clienteId: clienteIdFinal, consultaId: meta.consultaId });

  try {
    const snapshotRow = computeSnapshotRow({ ...args, clienteId: clienteIdFinal, cnpj: resolvedCnpj, nowISO });
    await upsertSnapshot(snapshotRow);
    console.info('SNAPSHOT_OK', {
      clienteId: clienteIdFinal,
      snapshotHash: snapshotRow.Snapshot_Hash,
      factsCount: Number(snapshotRow.Facts_Count) || 0,
    });

    const { inserted, skipped } = await appendFacts({
      ...args,
      clienteId: clienteIdFinal,
      cnpj: resolvedCnpj,
      nowISO,
    });
    console.info('FACTS_OK', { clienteId: clienteIdFinal, inserted, skipped });
    console.info('PERSIST_END', { clienteId: clienteIdFinal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL', { clienteId: clienteIdFinal, message });
    await markSnapshotError(clienteIdFinal, message, nowISO);
  }
}

export async function loadSnapshotCard({ clienteId }: LoadArgs): Promise<any | null> {
  if (!clienteId) return null;
  const { rows } = await getSheetData(SNAPSHOT_SHEET);
  const row = rows.find(r => toStringValue(r.Cliente_ID) === clienteId);
  if (!row) return null;

  const p1 = toStringValue(row.Resumo_Ultima_Consulta_JSON_P1 || '');
  const p2 = toStringValue(row.Resumo_Ultima_Consulta_JSON_P2 || '');
  const payload = p1 + p2;
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch (error) {
    console.error('SNAPSHOT_PARSE_FAIL', {
      clienteId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function __resetClienteIdSequenceForTests() {
  nextClienteSequence = null;
  resolveOverride = null;
}

export function __setResolveClienteIdOverrideForTests(
  fn: ((opts: ResolveOpts) => Promise<string>) | null,
) {
  resolveOverride = fn;
}

