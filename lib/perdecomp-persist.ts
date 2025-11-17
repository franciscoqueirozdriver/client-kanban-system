import crypto from 'crypto';

import {
  chunk,
  getSheetData,
  getSheetsClient,
  withRetry,
} from './googleSheets';
import { PERDCOMP_FACTS_COLUMNS, SHEETS } from './sheets-mapping';
import { formatPerdcompNumero } from '@/utils/perdcomp';
import {
  parsePerdcomp as parsePerdcompCodigo,
  TIPOS_DOCUMENTO,
  NATUREZA_FAMILIA,
  CREDITOS_DESCRICAO,
} from '@/lib/perdcomp';

type FactsColumn = keyof typeof PERDCOMP_FACTS_COLUMNS;
const PAYLOAD_SHARD_LIMIT_BYTES = 90000;
const CARD_SCHEMA_VERSION_FALLBACK = 'v1';
export const CLT_ID_RE = /^CLT-\d{4,}$/;

export type Meta = {
  fonte?: string;
  dataConsultaISO?: string;
  urlComprovante?: string;
  cardSchemaVersion?: string;
  renderedAtISO?: string;
  consultaId: string;
};

type ResolveOpts = { providedClienteId?: string | null; cnpj?: string | null };
type SaveArgs = {
  clienteId?: string | null;
  empresaId?: string | null;
  cnpj?: string | null;
  card: any;
  facts: any[];
  meta: Meta;
};

type LoadArgs = {
  clienteId: string;
};

type SheetRow = Record<string, string>;
type FactsRow = Record<FactsColumn, string>;

type RiskTag = { label: string; count: number };

export type DerivedRisk = { nivel: string; tags: RiskTag[] };

type PersistContext = {
  clienteId: string;
  empresaId?: string | null;
  nomeEmpresa: string;
  cnpj: string;
  meta: Meta;
  nowISO: string;
};

type FilterResult = {
  insert: FactsRow[];
  skip: number;
};

let nextClienteSequence: number | null = null;
let resolveOverride: ((opts: ResolveOpts) => Promise<string>) | null = null;
let cachedFactsHeaders: string[] | null = null;

const FACT_METADATA_FIELDS = new Set(['row_hash', 'consulta_id', 'inserted_at']);

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeSheetRow(row: Record<string, any>): SheetRow {
  const normalized: SheetRow = {};
  Object.entries(row ?? {}).forEach(([key, value]) => {
    if (key === '_rowNumber') return;
    normalized[key] = toStringValue(value);
  });
  return normalized;
}

function coalesceString(...values: Array<unknown>): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = toStringValue(value);
    if (str.trim() !== '') return str;
  }
  return '';
}

function onlyDigits(input?: string | null): string {
  return (input ?? '').replace(/\D+/g, '');
}

function toDDMMAA(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const aa = String(date.getUTCFullYear()).slice(-2);
  return `${dd}${mm}${aa}`;
}

function normalizeISO(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function uniqSortedISO(values: string[]): string[] {
  const set = new Set(values.filter(Boolean));
  return Array.from(set).sort();
}

function safeJSONStringify(input: any): string {
  try {
    return JSON.stringify(input ?? '');
  } catch (error) {
    return '';
  }
}

function splitPayloadIntoShards(payload: string): {
  shardP1: string;
  shardP2: string;
  bytes: number;
} {
  const totalBytes = Buffer.byteLength(payload, 'utf8');
  if (totalBytes <= PAYLOAD_SHARD_LIMIT_BYTES) {
    return { shardP1: payload, shardP2: '', bytes: totalBytes };
  }

  let endIndex = Math.min(payload.length, Math.floor(payload.length * 0.6));
  let shardP1 = payload.slice(0, endIndex);
  let shardP2 = payload.slice(endIndex);

  while (Buffer.byteLength(shardP1, 'utf8') > PAYLOAD_SHARD_LIMIT_BYTES && endIndex > 0) {
    endIndex -= Math.max(1, Math.floor(endIndex * 0.05));
    shardP1 = payload.slice(0, endIndex);
    shardP2 = payload.slice(endIndex);
  }

  if (Buffer.byteLength(shardP1, 'utf8') > PAYLOAD_SHARD_LIMIT_BYTES) {
    // Fallback: binary split by iterating backwards until it fits.
    endIndex = payload.length;
    shardP1 = payload;
    shardP2 = '';
    for (let i = payload.length - 1; i >= 0; i -= 1) {
      shardP1 = payload.slice(0, i);
      if (Buffer.byteLength(shardP1, 'utf8') <= PAYLOAD_SHARD_LIMIT_BYTES) {
        shardP2 = payload.slice(i);
        break;
      }
    }
  }

  if (Buffer.byteLength(shardP2, 'utf8') > PAYLOAD_SHARD_LIMIT_BYTES) {
    console.warn('PAYLOAD_SHARD_OVERFLOW', {
      shard: 'P2',
      bytes: Buffer.byteLength(shardP2, 'utf8'),
    });
  }

  return {
    shardP1,
    shardP2,
    bytes: totalBytes,
  };
}

function shortErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
}

function toFactsErrorMessage(error: unknown): string {
  return `FACTS_APPEND_ERROR: ${shortErrorMessage(error)}`;
}

function getTipoNomeFromCodigo(codigo?: string): string {
  if (!codigo) return '';
  const numero = Number(codigo);
  if (Number.isNaN(numero)) return '';
  const tipo = TIPOS_DOCUMENTO[numero];
  return tipo?.desc ?? tipo?.nome ?? '';
}

function getFamiliaFromNatureza(natureza?: string): string {
  if (!natureza) return '';
  return NATUREZA_FAMILIA[natureza] ?? '';
}

function getCreditoDescricaoFromCodigo(codigo?: string): string {
  if (!codigo) return '';
  return CREDITOS_DESCRICAO[codigo] ?? '';
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

async function getFactsHeaders(): Promise<string[]> {
  if (cachedFactsHeaders) return cachedFactsHeaders;
  const { headers } = await getSheetData(SHEETS.PERDCOMP_FACTS, 'A1:ZZ1');
  if (!headers.length) {
    throw new Error(`Sheet ${SHEETS.PERDCOMP_FACTS} is missing headers`);
  }
  cachedFactsHeaders = headers;
  return headers;
}

function pickCardString(card: any, ...paths: string[]): string | undefined {
  for (const path of paths) {
    const segments = path.split('.');
    let current: any = card;
    for (const key of segments) {
      if (current === null || current === undefined) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    if (typeof current === 'string' && current.trim() !== '') {
      return current;
    }
    if (typeof current === 'number' || typeof current === 'boolean') {
      return String(current);
    }
  }
  return undefined;
}

export function deriveRiskFromFacts(facts: SheetRow[]): DerivedRisk {
  const counts = new Map<string, number>();
  for (const fact of facts ?? []) {
    const nivel = coalesceString(fact?.risco_nivel) || 'DESCONHECIDO';
    counts.set(nivel, (counts.get(nivel) ?? 0) + 1);
  }

  const tags: RiskTag[] = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => (b.count === a.count ? a.label.localeCompare(b.label) : b.count - a.count));

  return {
    nivel: tags[0]?.label ?? '',
    tags,
  };
}

export function derivePorCreditoFromFacts(
  facts: SheetRow[],
): Array<{ label: string; count: number }> {
  const aggregates = new Map<string, { label: string; count: number }>();
  for (const fact of facts ?? []) {
    const label =
      coalesceString(fact?.credito_descricao, fact?.credito_codigo) || 'DESCONHECIDO';
    const existing = aggregates.get(label) ?? { label, count: 0 };
    existing.count += 1;
    aggregates.set(label, existing);
  }
  return Array.from(aggregates.values());
}

async function findClienteIdByCnpj(cnpj: string | null | undefined): Promise<string | null> {
  const normalized = onlyDigits(cnpj);
  if (!normalized) return null;
  const { rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);
  for (const row of rows) {
    const rowCnpj = onlyDigits(toStringValue(row.cnpj));
    if (rowCnpj !== normalized) continue;
    const candidate = toStringValue(row.cliente_id);
    if (CLT_ID_RE.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function syncNextSequenceFromId(id: string) {
  const match = id.match(/^CLT-(\d{4,})$/);
  if (!match) return;
  const value = Number(match[1]);
  if (!Number.isNaN(value)) {
    nextClienteSequence = Math.max(nextClienteSequence ?? value, value);
  }
}

export async function nextClienteId(): Promise<string> {
  if (nextClienteSequence === null) {
    const { rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);
    let max = 0;
    for (const row of rows) {
      const id = toStringValue(row.cliente_id);
      const match = id.match(/^CLT-(\d{4,})$/);
      if (!match) continue;
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        max = Math.max(max, value);
      }
    }
    nextClienteSequence = max;
  }
  nextClienteSequence = (nextClienteSequence ?? 0) + 1;
  return `CLT-${String(nextClienteSequence).padStart(4, '0')}`;
}

export async function resolveClienteId({ providedClienteId, cnpj }: ResolveOpts): Promise<string> {
  if (providedClienteId && CLT_ID_RE.test(providedClienteId)) {
    syncNextSequenceFromId(providedClienteId);
    return providedClienteId;
  }

  const found = await findClienteIdByCnpj(cnpj ?? null);
  if (found && CLT_ID_RE.test(found)) {
    syncNextSequenceFromId(found);
    return found;
  }

  const nextId = await nextClienteId();
  syncNextSequenceFromId(nextId);
  return nextId;
}

function mapFact(raw: any, ctx: PersistContext & { card?: any }): FactsRow {
  const perdcomp = coalesceString(raw.perdcomp_numero);
  const parsed = perdcomp ? parsePerdcompCodigo(perdcomp) : null;
  const parsedValid = Boolean(parsed?.valido);
  const parsedTipoCod =
    parsedValid && parsed?.bloco4 !== undefined ? String(parsed.bloco4) : '';
  const parsedNatureza = parsedValid ? toStringValue(parsed?.natureza ?? '') : '';
  const parsedFamilia = parsedNatureza ? getFamiliaFromNatureza(parsedNatureza) : '';
  const parsedCreditoCod = parsedValid ? toStringValue(parsed?.credito ?? '') : '';
  const parsedProtocolo = parsedValid ? toStringValue(parsed?.protocolo ?? '') : '';
  const parsedTipoNome = parsedValid ? getTipoNomeFromCodigo(parsedTipoCod) : '';
  const parsedCreditoDesc = parsedValid
    ? getCreditoDescricaoFromCodigo(parsedCreditoCod)
    : '';
  const parsedDataISO = parsedValid ? normalizeISO(parsed?.dataISO ?? '') : '';

  const protocolo = coalesceString(raw.protocolo, parsedProtocolo);
  const idLinha = perdcomp || protocolo;

  const dataISO = normalizeISO(
    raw.data_iso ??
      ctx.meta.dataConsultaISO ??
      ''
  );
  const dataISOFinal = dataISO || parsedDataISO || '';

  const tipoCod = coalesceString(raw.tipo_codigo, parsedTipoCod);
  const tipoNome = coalesceString(raw.tipo_nome, parsedTipoNome);
  const natureza = coalesceString(raw.natureza, parsedNatureza);
  const familia = coalesceString(
    raw.familia,
    parsedFamilia,
    parsedTipoCod === '1' || tipoCod === '1' ? 'DCOMP' : '',
    parsedTipoCod === '2' || tipoCod === '2' ? 'REST' : '',
    parsedTipoCod === '8' || tipoCod === '8' ? 'CANC' : '',
  );
  const creditoCod = coalesceString(raw.credito_codigo, parsedCreditoCod);
  const creditoDesc = coalesceString(raw.credito_descricao, parsedCreditoDesc);
  const riscoNivel = coalesceString(raw.risco_nivel);
  const situacao = toStringValue(raw.situacao ?? '');
  const situacaoDetalhamento = toStringValue(raw.situacao_detalhamento ?? '');
  const solicitante = toStringValue(raw.solicitante ?? '');
  const motivoNormalizado = toStringValue(raw.motivo_normalizado ?? '');
  const valor = toStringValue(raw.valor ?? '');
  const nomeEmpresa = ctx.nomeEmpresa || toStringValue(raw.nome_da_empresa);

  const rowHash = idLinha
    ? sha256([idLinha, tipoCod, natureza, creditoCod, dataISOFinal, valor].join('|'))
    : sha256(
        JSON.stringify(
          Object.keys(raw ?? {})
            .filter((key) => !FACT_METADATA_FIELDS.has(key))
            .sort()
            .reduce<Record<string, any>>((acc, key) => {
              acc[key] = raw[key];
              return acc;
            }, {})
        )
      );

  const b1 = toStringValue(raw.b1 ?? '');
  const b2 = toStringValue(raw.b2 ?? '');

  const row: FactsRow = {
    cliente_id: ctx.clienteId,
    empresa_id: toStringValue(ctx.empresaId ?? ''),
    nome_da_empresa: nomeEmpresa,
    cnpj: onlyDigits(ctx.cnpj),

    perdcomp_numero: perdcomp,
    perdcomp_formatado: perdcomp ? formatPerdcompNumero(perdcomp) : '',
    b1: b1,
    b2: b2,
    data_ddmmaa: toDDMMAA(dataISOFinal),
    data_iso: dataISOFinal,
    tipo_codigo: tipoCod,
    tipo_nome: tipoNome,
    natureza: natureza,
    familia: familia,
    credito_codigo: creditoCod,
    credito_descricao: creditoDesc,
    risco_nivel: riscoNivel,
    protocolo: protocolo,
    situacao: situacao,
    situacao_detalhamento: situacaoDetalhamento,
    motivo_normalizado: motivoNormalizado,
    solicitante: solicitante,
    fonte: toStringValue(ctx.meta.fonte ?? ''),
    data_consulta: toStringValue(ctx.meta.dataConsultaISO ?? ctx.nowISO),
    url_comprovante_html: toStringValue(ctx.meta.urlComprovante ?? ''),
    row_hash: rowHash,
    inserted_at: ctx.nowISO,
    consulta_id: toStringValue(ctx.meta.consultaId),
    version: toStringValue(ctx.meta.cardSchemaVersion ?? 'v1'),
    deleted_flag: '0',
  };

  return row;
}

function mapSnapshotRow(
  ctx: PersistContext & {
    card: any;
    facts: FactsRow[];
  }
): SheetRow {
  const { card, facts, meta, nowISO } = ctx;
  const resumo = card?.resumo ?? card?.perdcompResumo ?? {};
  const porFamilia =
    card?.agregados?.porFamilia ?? resumo?.porFamilia ?? {
      DCOMP: 0,
      REST: 0,
      RESSARC: 0,
    };
  const porNatureza =
    card?.agregados?.porNatureza ?? card?.porNatureza ?? resumo?.porNaturezaAgrupada ?? [];

  const cardRiskNivel = coalesceString(card?.risk?.nivel);
  const cardRiskTags = Array.isArray(card?.risk?.tags) ? (card?.risk?.tags ?? []) : [];
  const derivedRisk = deriveRiskFromFacts(facts);
  const risk = {
    nivel: cardRiskNivel || derivedRisk.nivel,
    tags: (cardRiskNivel || cardRiskTags.length)
      ? cardRiskTags
      : derivedRisk.tags,
  };

  const porCreditoCandidate = card?.agregados?.porCredito ?? card?.porCredito ?? null;
  const porCredito =
    Array.isArray(porCreditoCandidate) && porCreditoCandidate.length
      ? porCreditoCandidate
      : derivePorCreditoFromFacts(facts);

  const datas = uniqSortedISO([
    ...((card?.datas as string[]) ?? []),
    ...facts.map((fact) => fact.data_iso).filter(Boolean),
  ]);
  const primeiraData = datas[0] ?? '';
  const ultimaData = datas[datas.length - 1] ?? '';

  const payload = safeJSONStringify(card);
  const { shardP1, shardP2, bytes } = splitPayloadIntoShards(payload);
  const snapshotHash = sha256(shardP1 + shardP2);

  return {
    cliente_id: ctx.clienteId,
    empresa_id: toStringValue(ctx.empresaId ?? ''),
    nome_da_empresa: ctx.nomeEmpresa || (facts && facts[0]?.nome_da_empresa) || '',
    cnpj: onlyDigits(ctx.cnpj),

    qtd_total: String(resumo?.total ?? facts.length ?? 0),
    qtd_dcomp: String(porFamilia?.DCOMP ?? 0),
    qtd_rest: String(porFamilia?.REST ?? 0),
    qtd_ressarc: String(porFamilia?.RESSARC ?? 0),

    risco_nivel: risk.nivel ?? '',
    risco_tags_json: safeJSONStringify(risk.tags ?? []),

    por_natureza_json: safeJSONStringify(porNatureza),
    por_credito_json: safeJSONStringify(porCredito),

    datas_json: safeJSONStringify(datas),
    primeira_data_iso: primeiraData,
    ultima_data_iso: ultimaData,

    resumo_ultima_consulta_json_p1: shardP1,
    resumo_ultima_consulta_json_p2: shardP2,
    payload_bytes: String(bytes),
    snapshot_hash: snapshotHash,

    card_schema_version: meta.cardSchemaVersion ?? CARD_SCHEMA_VERSION_FALLBACK,
    rendered_at_iso: meta.renderedAtISO ?? nowISO,
    fonte: meta.fonte ?? '',
    data_consulta: meta.dataConsultaISO ?? nowISO,
    url_comprovante_html: meta.urlComprovante ?? '',

    facts_count: String(ctx.facts.length ?? 0),

    last_updated_iso: nowISO,
    consulta_id: meta.consultaId,

    erro_ultima_consulta: '',
  };
}

async function upsertSnapshot(row: SheetRow) {
  const { headers, rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);
  const sheets = await getSheetsClient();
  if (!headers.length) {
    throw new Error(`Sheet ${SHEETS.PERDECOMP_SNAPSHOT} is missing headers`);
  }
  const existing = rows.find((r) => toStringValue(r.cliente_id) === row.cliente_id);

  if (existing) {
    const merged: Record<string, string> = {};
    headers.forEach((header) => {
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
          range: `${SHEETS.PERDECOMP_SNAPSHOT}!${colLetter}${existing._rowNumber}`,
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
        })
      );
    }
    return;
  }

  const values = headers.map((header) => row[header] ?? '');
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: SHEETS.PERDECOMP_SNAPSHOT,
      valueInputOption: 'RAW',
      requestBody: {
        values: [values],
      },
    })
  );
}

async function filterNewFacts(clienteId: string, rows: FactsRow[]): Promise<FilterResult> {
  if (!rows.length) return { insert: [], skip: 0 };
  const existingKeys = new Set<string>();

  try {
    const { rows: existingRows } = await getSheetData(SHEETS.PERDCOMP_FACTS);
    for (const row of existingRows) {
      if (toStringValue(row.cliente_id) !== clienteId) continue;
      const numero = toStringValue(row.perdcomp_numero ?? row.protocolo ?? '');
      const hash = toStringValue(row.row_hash ?? '');
      const key = `${clienteId}|${numero}|${hash}`;
      existingKeys.add(key);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('FACTS_READ_FAIL', { sheetName: SHEETS.PERDCOMP_FACTS, message });
  }

  const insert: FactsRow[] = [];
  let skip = 0;

  for (const row of rows) {
    const numero = toStringValue(row.perdcomp_numero ?? row.protocolo ?? '');
    const hash = toStringValue(row.row_hash ?? '');
    const key = `${clienteId}|${numero}|${hash}`;
    if (existingKeys.has(key)) {
      skip += 1;
      continue;
    }
    existingKeys.add(key);
    insert.push(row);
  }

  return { insert, skip };
}

async function readFactsByClienteId(clienteId: string): Promise<SheetRow[]> {
  if (!clienteId) return [];
  const all: SheetRow[] = [];
  try {
    const { rows } = await getSheetData(SHEETS.PERDCOMP_FACTS);
    for (const row of rows) {
      if (toStringValue(row.cliente_id) !== clienteId) continue;
      all.push(normalizeSheetRow(row));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('FACTS_READ_FAIL', { sheetName: SHEETS.PERDCOMP_FACTS, message });
  }
  return all;
}

async function appendFactsBatched(
  rows: FactsRow[],
  batchSize = 2000,
  maxRetries = 4,
): Promise<{ inserted: number; errors: Error[] }> {
  if (!rows.length) return { inserted: 0, errors: [] };
  const headers = await getFactsHeaders();
  const orderedHeaders =
    headers.length === Object.keys(PERDCOMP_FACTS_COLUMNS).length &&
    Object.keys(PERDCOMP_FACTS_COLUMNS).every((column, index) => headers[index] === column)
      ? headers
      : Object.keys(PERDCOMP_FACTS_COLUMNS);
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const sheets = await getSheetsClient();
  const values = rows.map((row) =>
    orderedHeaders.map((header) => row[header as FactsColumn] ?? ''),
  );
  const batches = chunk(values, batchSize);
  let inserted = 0;
  const errors: Error[] = [];

  for (const batch of batches) {
    try {
      await withRetry(
        () =>
          sheets.spreadsheets.values.append({
            spreadsheetId,
            range: SHEETS.PERDCOMP_FACTS,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: batch },
          }),
        maxRetries,
      );
      inserted += batch.length;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      console.warn('FACTS_BATCH_APPEND_FAIL', {
        sheetName: SHEETS.PERDCOMP_FACTS,
        batchSize: batch.length,
        message: err.message,
      });
    }
  }

  return { inserted, errors };
}

async function updateSnapshotFields(
  clienteId: string,
  updates: Record<string, string>,
): Promise<boolean> {
  if (!clienteId) return false;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const { headers, rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);
  if (!headers.length) return false;
  const existing = rows.find((row) => toStringValue(row.cliente_id) === clienteId);
  if (!existing) return false;

  const data: Array<{ range: string; values: string[][] }> = [];
  const sheets = await getSheetsClient();

  Object.entries(updates).forEach(([header, value]) => {
    const index = headers.indexOf(header);
    if (index === -1) return;
    const colLetter = columnNumberToLetter(index + 1);
    data.push({
      range: `${SHEETS.PERDECOMP_SNAPSHOT}!${colLetter}${existing._rowNumber}`,
      values: [[toStringValue(value)]],
    });
  });

  if (!data.length) return false;

  await withRetry(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data,
      },
    })
  );
  return true;
}

async function markSnapshotError(clienteId: string, message: string, nowISO: string) {
  try {
    const updated = await updateSnapshotFields(clienteId, {
      erro_ultima_consulta: message,
      last_updated_iso: nowISO,
    });
    if (!updated) {
      console.warn('PERSIST_FAIL_MARK_ERROR_ROW_MISSING', { clienteId, message });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL_MARK_ERROR', { clienteId, message: msg });
  }
}

async function markSnapshotPostFacts(
  clienteId: string,
  params: { factsCount: number; error: string | null; nowISO: string },
) {
  const { factsCount, error, nowISO } = params;
  try {
    const updated = await updateSnapshotFields(clienteId, {
      facts_count: String(factsCount ?? 0),
      erro_ultima_consulta: error ?? '',
      last_updated_iso: nowISO,
    });
    if (!updated) {
      console.warn('PERSIST_FAIL_MARK_POST_FACTS', { clienteId, error });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PERSIST_FAIL_POST_FACTS', { clienteId, message });
  }
}

export async function savePerdecompResults(args: SaveArgs): Promise<void> {
  if (!args?.meta?.consultaId) {
    throw new Error('meta.consultaId is required');
  }

  const nowISO = new Date().toISOString();
  const card = args.card ?? {};

  const cnpjFinal =
    args.cnpj ??
    pickCardString(card, 'header.cnpj', 'cnpj') ??
    '';

  const resolverFn = resolveOverride ?? resolveClienteId;

  const clienteIdFinal = await resolverFn({
    providedClienteId: args.clienteId,
    cnpj: cnpjFinal ?? null,
  });

  if (!CLT_ID_RE.test(clienteIdFinal)) {
    console.warn('PERSIST_ABORT_INVALID_CLIENTE_ID', {
      provided: args.clienteId ?? null,
      resolved: clienteIdFinal,
      cnpj: args.cnpj,
    });
    throw new Error('Invalid cliente_id for persistence');
  }

  const empresaId =
    args.empresaId ?? pickCardString(card, 'header.empresaId', 'empresa_id') ?? '';
  const nomeEmpresa =
    pickCardString(
      card,
      'nomeEmpresa',
      'header.nomeEmpresa',
      'nome_da_empresa'
    ) ?? '';

  const ctx: PersistContext = {
    clienteId: clienteIdFinal,
    empresaId,
    nomeEmpresa,
    cnpj: cnpjFinal ?? '',
    meta: args.meta,
    nowISO,
  };

  console.info('PERSIST_START', { clienteId: clienteIdFinal, consultaId: args.meta.consultaId });

  try {
    const sanitizedCard = { ...card, clienteId: clienteIdFinal };
    const mappedFacts = (args.facts ?? []).map((raw) =>
      mapFact(raw, { ...ctx, card: sanitizedCard }),
    );

    const snapshotRow = mapSnapshotRow({ ...ctx, card: sanitizedCard, facts: mappedFacts });
    await upsertSnapshot(snapshotRow);
    console.info('SNAPSHOT_OK', {
      clienteId: clienteIdFinal,
      snapshotHash: snapshotRow.snapshot_hash,
      factsCount: mappedFacts.length,
    });

    let inserted = 0;
    let skip = 0;
    let factsError: string | null = null;

    try {
      const { insert, skip: skipCount } = await filterNewFacts(clienteIdFinal, mappedFacts);
      skip = skipCount;
      if (insert.length) {
        const { inserted: appended, errors } = await appendFactsBatched(insert);
        inserted = appended;
        if (errors.length) {
          factsError = toFactsErrorMessage(errors[0]);
        }
      }
    } catch (error) {
      factsError = toFactsErrorMessage(error);
    }

    await markSnapshotPostFacts(clienteIdFinal, {
      factsCount: mappedFacts.length,
      error: factsError,
      nowISO,
    });

    if (factsError) {
      console.warn('FACTS_FAIL_SOFT', {
        clienteId: clienteIdFinal,
        error: factsError,
        inserted,
        skipped: skip,
      });
    } else {
      console.info('FACTS_OK', {
        clienteId: clienteIdFinal,
        inserted,
        skipped: skip,
      });
    }

    console.info('PERSIST_END', { clienteId: clienteIdFinal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL', { clienteId: clienteIdFinal, message });
    await markSnapshotError(clienteIdFinal, message, nowISO);
  }
}

export async function loadSnapshotCard({ clienteId }: LoadArgs): Promise<any | null> {
  if (!clienteId) return null;
  const { rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);
  const row = rows.find((item) => toStringValue(item.cliente_id) === clienteId);
  if (!row) return null;
  const p1 = toStringValue(row.resumo_ultima_consulta_json_p1 ?? '');
  const p2 = toStringValue(row.resumo_ultima_consulta_json_p2 ?? '');
  const payload = p1 + p2;
  if (!payload) return null;
  try {
    const card = JSON.parse(payload || '{}');

    const needsRisk = !card?.risk || !coalesceString(card?.risk?.nivel);
    const needsCredito =
      !card?.agregados ||
      !Array.isArray(card.agregados?.porCredito) ||
      card.agregados.porCredito.length === 0;

    if (needsRisk || needsCredito) {
      const facts = await readFactsByClienteId(clienteId);
      if (needsRisk) {
        const derived = deriveRiskFromFacts(facts);
        card.risk = {
          ...(card?.risk ?? {}),
          nivel: coalesceString(card?.risk?.nivel, derived.nivel),
          tags: Array.isArray(card?.risk?.tags) && card.risk.tags.length
            ? card.risk.tags
            : derived.tags,
        };
      }
      if (needsCredito) {
        const derived = derivePorCreditoFromFacts(facts);
        card.agregados = {
          ...(card?.agregados ?? {}),
          porCredito: derived,
        };
      }
    }

    return card;
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
  cachedFactsHeaders = null;
}

export function __setResolveClienteIdOverrideForTests(
  fn: ((opts: ResolveOpts) => Promise<string>) | null,
) {
  resolveOverride = fn;
}
