import crypto from 'crypto';

import {
  chunk,
  getSheetData,
  getSheetsClient,
  withRetry,
} from './googleSheets.js';
import { formatPerdcompNumero } from '@/utils/perdcomp';
import {
  parsePerdcomp as parsePerdcompCodigo,
  TIPOS_DOCUMENTO,
  NATUREZA_FAMILIA,
  CREDITOS_DESCRICAO,
} from '@/lib/perdcomp';

export const SHEET_SNAPSHOT = 'perdecomp_snapshot';
export const SHEET_FACTS = 'perdecomp_facts';
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
  insert: SheetRow[];
  skip: number;
};

let nextClienteSequence: number | null = null;
let resolveOverride: ((opts: ResolveOpts) => Promise<string>) | null = null;

const FACT_METADATA_FIELDS = new Set(['Row_Hash', 'Consulta_ID', 'Inserted_At']);

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
    const nivel = coalesceString(fact?.Risco_Nivel, fact?.risco) || 'DESCONHECIDO';
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
      coalesceString(fact?.Credito_Descricao, fact?.Credito_Codigo) || 'DESCONHECIDO';
    const existing = aggregates.get(label) ?? { label, count: 0 };
    existing.count += 1;
    aggregates.set(label, existing);
  }
  return Array.from(aggregates.values());
}

async function findClienteIdByCnpj(cnpj: string | null | undefined): Promise<string | null> {
  const normalized = onlyDigits(cnpj);
  if (!normalized) return null;
  const { rows } = await getSheetData(SHEET_SNAPSHOT);
  for (const row of rows) {
    const rowCnpj = onlyDigits(toStringValue(row.CNPJ));
    if (rowCnpj !== normalized) continue;
    const candidate = toStringValue(row.Cliente_ID);
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
    const { rows } = await getSheetData(SHEET_SNAPSHOT);
    let max = 0;
    for (const row of rows) {
      const id = toStringValue(row.Cliente_ID);
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

function mapFact(raw: any, ctx: PersistContext & { card?: any }): SheetRow {
  const perdcomp = coalesceString(
    raw.Perdcomp_Numero,
    raw.perdcompNumero,
    raw.perdcomp,
    raw.numero
  );
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

  const protocolo = coalesceString(raw.Protocolo, raw.protocolo, parsedProtocolo);
  const idLinha = perdcomp || protocolo;

  const dataISO = normalizeISO(
    raw.Data_ISO ??
      raw.dataISO ??
      raw.data ??
      raw.dataConsulta ??
      parsedDataISO ??
      ctx.meta.dataConsultaISO ??
      ''
  );
  const dataISOFinal = dataISO || parsedDataISO || '';

  const tipoCod = coalesceString(raw.Tipo_Codigo, raw.tipoCodigo, parsedTipoCod);
  const tipoNome = coalesceString(
    raw.Tipo_Nome,
    raw.tipoNome,
    raw.tipo,
    parsedTipoNome
  );
  const natureza = coalesceString(raw.Natureza, raw.natureza, parsedNatureza);
  const familia = coalesceString(
    raw.Familia,
    raw.familia,
    parsedFamilia,
    parsedTipoCod === '1' || tipoCod === '1' ? 'DCOMP' : '',
    parsedTipoCod === '2' || tipoCod === '2' ? 'REST' : '',
    parsedTipoCod === '8' || tipoCod === '8' ? 'CANC' : '',
  );
  const creditoCod = coalesceString(
    raw.Credito_Codigo,
    raw.creditoCodigo,
    parsedCreditoCod
  );
  const creditoDesc = coalesceString(
    raw.Credito_Descricao,
    raw.creditoDescricao,
    raw.Credito,
    raw.credito,
    parsedCreditoDesc
  );
  const riscoNivel = coalesceString(
    raw.Risco_Nivel,
    raw.risco,
    ctx.card?.risk?.nivel,
    ctx.card?.risk?.level,
  );
  const situacao = toStringValue(raw.Situacao ?? raw.situacao ?? '');
  const situacaoDetalhamento = toStringValue(
    raw.Situacao_Detalhamento ?? raw.situacaoDetalhamento ?? ''
  );
  const solicitante = toStringValue(raw.Solicitante ?? raw.solicitante ?? '');
  const motivoNormalizado = toStringValue(raw.Motivo_Normalizado ?? '');
  const valor = toStringValue(raw.Valor ?? raw.valor ?? '');

  const baseHash = idLinha
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

  return {
    Cliente_ID: ctx.clienteId,
    Empresa_ID: toStringValue(ctx.empresaId ?? ''),
    'Nome da Empresa': ctx.nomeEmpresa ?? '',
    CNPJ: onlyDigits(ctx.cnpj),

    Perdcomp_Numero: perdcomp,
    Perdcomp_Formatado: perdcomp ? formatPerdcompNumero(perdcomp) : '',
    Protocolo: protocolo,

    Data_DDMMAA: toDDMMAA(dataISOFinal),
    Data_ISO: dataISOFinal,

    Tipo_Codigo: tipoCod,
    Tipo_Nome: tipoNome,
    Natureza: natureza,
    Familia: familia,

    Credito_Codigo: creditoCod,
    Credito_Descricao: creditoDesc,
    Risco_Nivel: riscoNivel,

    Situacao: situacao,
    Situacao_Detalhamento: situacaoDetalhamento,
    Motivo_Normalizado: motivoNormalizado,

    Solicitante: solicitante,

    Fonte: ctx.meta.fonte ?? '',
    Data_Consulta: ctx.meta.dataConsultaISO ?? ctx.nowISO,
    URL_Comprovante_HTML: ctx.meta.urlComprovante ?? '',

    Row_Hash: baseHash,
    Inserted_At: ctx.nowISO,
    Consulta_ID: ctx.meta.consultaId,

    Version: 'v1',
    Deleted_Flag: '',
  };
}

function mapSnapshotRow(
  ctx: PersistContext & {
    card: any;
    facts: SheetRow[];
    insertedCount: number;
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

  const cardRiskNivel = coalesceString(
    card?.risk?.nivel,
    card?.risk?.level,
    card?.risco?.nivel,
  );
  const cardRiskTags = Array.isArray(card?.risk?.tags ?? card?.riskTags)
    ? (card?.risk?.tags ?? card?.riskTags ?? [])
    : [];
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
    ...facts.map((fact) => fact.Data_ISO).filter(Boolean),
  ]);
  const primeiraData = datas[0] ?? '';
  const ultimaData = datas[datas.length - 1] ?? '';

  const payload = safeJSONStringify(card);
  const { shardP1, shardP2, bytes } = splitPayloadIntoShards(payload);
  const snapshotHash = sha256(shardP1 + shardP2);

  return {
    Cliente_ID: ctx.clienteId,
    Empresa_ID: toStringValue(ctx.empresaId ?? ''),
    'Nome da Empresa': ctx.nomeEmpresa ?? '',
    CNPJ: onlyDigits(ctx.cnpj),

    Qtd_Total: String(resumo?.total ?? facts.length ?? 0),
    Qtd_DCOMP: String(porFamilia?.DCOMP ?? 0),
    Qtd_REST: String(porFamilia?.REST ?? 0),
    Qtd_RESSARC: String(porFamilia?.RESSARC ?? 0),

    Risco_Nivel: risk.nivel ?? '',
    Risco_Tags_JSON: safeJSONStringify(risk.tags ?? []),

    Por_Natureza_JSON: safeJSONStringify(porNatureza),
    Por_Credito_JSON: safeJSONStringify(porCredito),

    Datas_JSON: safeJSONStringify(datas),
    Primeira_Data_ISO: primeiraData,
    Ultima_Data_ISO: ultimaData,

    Resumo_Ultima_Consulta_JSON_P1: shardP1,
    Resumo_Ultima_Consulta_JSON_P2: shardP2,
    Payload_Bytes: String(bytes),
    Snapshot_Hash: snapshotHash,

    Card_Schema_Version: meta.cardSchemaVersion ?? CARD_SCHEMA_VERSION_FALLBACK,
    Rendered_At_ISO: meta.renderedAtISO ?? nowISO,
    Fonte: meta.fonte ?? '',
    Data_Consulta: meta.dataConsultaISO ?? nowISO,
    URL_Comprovante_HTML: meta.urlComprovante ?? '',

    Facts_Count: String(ctx.insertedCount ?? 0),

    Last_Updated_ISO: nowISO,
    Consulta_ID: meta.consultaId,

    Erro_Ultima_Consulta: '',
  };
}

async function upsertSnapshot(row: SheetRow) {
  const { headers, rows } = await getSheetData(SHEET_SNAPSHOT);
  const sheets = await getSheetsClient();
  if (!headers.length) {
    throw new Error(`Sheet ${SHEET_SNAPSHOT} is missing headers`);
  }
  const existing = rows.find((r) => toStringValue(r.Cliente_ID) === row.Cliente_ID);

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
          range: `${SHEET_SNAPSHOT}!${colLetter}${existing._rowNumber}`,
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
      range: SHEET_SNAPSHOT,
      valueInputOption: 'RAW',
      requestBody: {
        values: [values],
      },
    })
  );
}

async function filterNewFacts(clienteId: string, rows: SheetRow[]): Promise<FilterResult> {
  if (!rows.length) return { insert: [], skip: 0 };
  const { headers, rows: existingRows } = await getSheetData(SHEET_FACTS);
  if (!headers.length) {
    throw new Error(`Sheet ${SHEET_FACTS} is missing headers`);
  }
  const relevant = existingRows.filter((row) => toStringValue(row.Cliente_ID) === clienteId);
  const existingKeys = new Set(
    relevant.map((row) => {
      const numero = toStringValue(row.Perdcomp_Numero ?? row.Protocolo ?? '');
      const hash = toStringValue(row.Row_Hash ?? '');
      return `${numero}|${hash}`;
    })
  );

  const insert: SheetRow[] = [];
  let skip = 0;

  for (const row of rows) {
    const numero = toStringValue(row.Perdcomp_Numero ?? row.Protocolo ?? '');
    const hash = toStringValue(row.Row_Hash ?? '');
    const key = `${numero}|${hash}`;
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
  const { rows } = await getSheetData(SHEET_FACTS);
  return rows
    .filter((row) => toStringValue(row.Cliente_ID) === clienteId)
    .map((row) => normalizeSheetRow(row));
}

async function appendFacts(rows: SheetRow[]): Promise<number> {
  if (!rows.length) return 0;
  const { headers } = await getSheetData(SHEET_FACTS);
  if (!headers.length) {
    throw new Error(`Sheet ${SHEET_FACTS} is missing headers`);
  }
  const sheets = await getSheetsClient();
  const rowsToAppend = rows.map((row) => headers.map((header) => row[header] ?? ''));
  const batches = chunk(rowsToAppend, 500);
  for (const batch of batches) {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: SHEET_FACTS,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: batch,
        },
      })
    );
  }
  return rows.length;
}

async function markSnapshotError(clienteId: string, message: string, nowISO: string) {
  try {
    const { headers, rows } = await getSheetData(SHEET_SNAPSHOT);
    const sheets = await getSheetsClient();
    const existing = rows.find((row) => toStringValue(row.Cliente_ID) === clienteId);
    const errorIdx = headers.indexOf('Erro_Ultima_Consulta');
    const lastUpdatedIdx = headers.indexOf('Last_Updated_ISO');

    if (existing && errorIdx !== -1) {
      const data: Array<{ range: string; values: string[][] }> = [];
      const errorLetter = columnNumberToLetter(errorIdx + 1);
      data.push({
        range: `${SHEET_SNAPSHOT}!${errorLetter}${existing._rowNumber}`,
        values: [[message]],
      });
      if (lastUpdatedIdx !== -1) {
        const lastLetter = columnNumberToLetter(lastUpdatedIdx + 1);
        data.push({
          range: `${SHEET_SNAPSHOT}!${lastLetter}${existing._rowNumber}`,
          values: [[nowISO]],
        });
      }
      if (data.length) {
        await withRetry(() =>
          sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            requestBody: {
              valueInputOption: 'RAW',
              data,
            },
          })
        );
      }
      return;
    }

    if (!headers.length || errorIdx === -1) return;

    const values = headers.map((header) => {
      if (header === 'Cliente_ID') return clienteId;
      if (header === 'Erro_Ultima_Consulta') return message;
      if (header === 'Last_Updated_ISO') return nowISO;
      return '';
    });

    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: SHEET_SNAPSHOT,
        valueInputOption: 'RAW',
        requestBody: {
          values: [values],
        },
      })
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL_MARK_ERROR', { clienteId, message: msg });
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
    pickCardString(card, 'header.cnpj', 'CNPJ', 'cnpj', 'CNPJ_Empresa') ??
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
    throw new Error('Invalid Cliente_ID for persistence');
  }

  const empresaId =
    args.empresaId ?? pickCardString(card, 'header.empresaId', 'empresaId', 'Empresa_ID') ?? '';
  const nomeEmpresa =
    pickCardString(
      card,
      'nomeEmpresa',
      'header.nomeEmpresa',
      'Nome_da_Empresa',
      'Nome da Empresa',
      'empresa',
      'empresa.nome'
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
    const mappedFacts = (args.facts ?? []).map((raw) => mapFact(raw, { ...ctx, card }));
    const { insert, skip } = await filterNewFacts(clienteIdFinal, mappedFacts);
    const insertedCount = await appendFacts(insert);
    console.info('FACTS_OK', { clienteId: clienteIdFinal, inserted: insertedCount, skipped: skip });

    const snapshotRow = mapSnapshotRow({ ...ctx, card, facts: mappedFacts, insertedCount });
    await upsertSnapshot(snapshotRow);
    console.info('SNAPSHOT_OK', {
      clienteId: clienteIdFinal,
      snapshotHash: snapshotRow.Snapshot_Hash,
      factsCount: Number(snapshotRow.Facts_Count) || 0,
    });

    console.info('PERSIST_END', { clienteId: clienteIdFinal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PERSIST_FAIL', { clienteId: clienteIdFinal, message });
    await markSnapshotError(clienteIdFinal, message, nowISO);
  }
}

export async function loadSnapshotCard({ clienteId }: LoadArgs): Promise<any | null> {
  if (!clienteId) return null;
  const { rows } = await getSheetData(SHEET_SNAPSHOT);
  const row = rows.find((item) => toStringValue(item.Cliente_ID) === clienteId);
  if (!row) return null;
  const p1 = toStringValue(row.Resumo_Ultima_Consulta_JSON_P1 ?? '');
  const p2 = toStringValue(row.Resumo_Ultima_Consulta_JSON_P2 ?? '');
  const payload = p1 + p2;
  if (!payload) return null;
  try {
    const card = JSON.parse(payload || '{}');

    const needsRisk = !card?.risk || !coalesceString(card?.risk?.nivel, card?.risk?.level);
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
          nivel: coalesceString(card?.risk?.nivel, card?.risk?.level, derived.nivel),
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
}

export function __setResolveClienteIdOverrideForTests(
  fn: ((opts: ResolveOpts) => Promise<string>) | null,
) {
  resolveOverride = fn;
}
