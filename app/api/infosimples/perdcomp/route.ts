import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import {
  loadSnapshotCard,
  resolveClienteId,
  savePerdecompResults,
} from '@/lib/perdecomp-persist';
import { normalizeCNPJ, isValidCNPJ } from '@/src/utils/cnpj';
import {
  agregaPerdcomp,
  classificaFamiliaPorNatureza,
  parsePerdcompNumero,
} from '@/utils/perdcomp';

export const runtime = 'nodejs';

const CARD_SCHEMA_VERSION = 'perdecomp-card-v1';
const INFOSIMPLES_ENDPOINT =
  'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addYears(dateISO: string, years: number) {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function jitter(base: number) {
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delays = [1500, 3000, 5000],
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status ?? err?.status ?? 0;
      const shouldRetry = status >= 500 || status === 0;
      if (!shouldRetry || i === attempts - 1) throw err;
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastErr;
}

function normalizeFactValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

type PickPerdecompSourceParams = {
  refazer: boolean;
  clienteId: string;
  cnpj: string;
  nomeEmpresa: string;
  empresaId?: string | null;
  dataInicio: string;
  dataFim: string;
  debugMode: boolean;
  requestedAtISO: string;
};

type PickPerdecompSourceResult = {
  source: 'LIVE' | 'SNAPSHOT';
  card: any;
  facts: any[];
  meta: {
    dataConsultaISO?: string;
    urlComprovante?: string;
  };
};

function normalizePerdcompFacts(
  perdcomp: any[],
  {
    clienteId,
    empresaId,
    nomeEmpresa,
    cnpj,
  }: { clienteId: string; empresaId?: string | null; nomeEmpresa?: string | null; cnpj: string },
) {
  return (perdcomp || []).map(item => {
    const parsed = parsePerdcompNumero(item?.perdcomp || '');
    const familia = parsed.valido ? classificaFamiliaPorNatureza(parsed.natureza) : 'DESCONHECIDO';

    return {
      Cliente_ID: clienteId,
      Empresa_ID: empresaId ?? '',
      Nome_da_Empresa: nomeEmpresa ?? '',
      CNPJ: cnpj,
      Perdcomp_Numero: normalizeFactValue(item?.perdcomp),
      Protocolo: parsed.valido ? normalizeFactValue(parsed.protocolo) : '',
      Natureza: parsed.valido ? normalizeFactValue(parsed.natureza) : '',
      Credito: parsed.valido ? normalizeFactValue(parsed.credito) : '',
      Data_ISO: parsed.valido ? normalizeFactValue(parsed.dataISO) : '',
      Familia: normalizeFactValue(familia),
      Tipo_Documento: normalizeFactValue(item?.tipo_documento),
      Tipo_Credito: normalizeFactValue(item?.tipo_credito),
      Situacao: normalizeFactValue(item?.situacao),
      Situacao_Detalhamento: normalizeFactValue(item?.situacao_detalhamento),
      Data_Transmissao: normalizeFactValue(item?.data_transmissao),
      Data_Protocolo: normalizeFactValue(item?.data_protocolo),
      Periodo_Inicio: normalizeFactValue(item?.periodo_inicio),
      Periodo_Fim: normalizeFactValue(item?.periodo_fim),
      Numero_Processo: normalizeFactValue(item?.numero_processo),
      Valor: normalizeFactValue(item?.valor),
      Solicitante: normalizeFactValue(item?.solicitante),
    };
  });
}

async function pickPerdecompSource(
  params: PickPerdecompSourceParams,
): Promise<PickPerdecompSourceResult> {
  const {
    refazer,
    clienteId,
    cnpj,
    nomeEmpresa,
    empresaId,
    dataInicio,
    dataFim,
    debugMode,
    requestedAtISO,
  } = params;

  if (!refazer) {
    const snapshotCard = await loadSnapshotCard({ clienteId });
    if (snapshotCard) {
      const perdcompArray = Array.isArray(snapshotCard?.perdcomp)
        ? snapshotCard.perdcomp
        : [];
      const mappedCount = snapshotCard?.mappedCount ?? perdcompArray.length ?? 0;
      const headerRequestedAt =
        snapshotCard?.header?.requested_at ?? snapshotCard?.requestedAt ?? null;
      const card = {
        ...snapshotCard,
        ok: snapshotCard?.ok ?? true,
        fonte: 'perdecomp_snapshot',
        mappedCount: snapshotCard?.mappedCount ?? mappedCount,
        header: {
          ...(snapshotCard?.header ?? {}),
          requested_at: headerRequestedAt,
          cnpj,
          nomeEmpresa,
          clienteId,
        },
        clienteId,
        nomeEmpresa,
        empresaId: empresaId ?? null,
      };

      if (debugMode) {
        card.debug = {
          ...(card.debug ?? {}),
          requestedAt: requestedAtISO,
          fonte: 'perdecomp_snapshot',
          mappedCount,
        };
      }

      return {
        source: 'SNAPSHOT',
        card,
        facts: [],
        meta: {
          dataConsultaISO: headerRequestedAt ?? undefined,
          urlComprovante:
            snapshotCard?.site_receipt ?? snapshotCard?.header?.site_receipt ?? undefined,
        },
      };
    }
  }

  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
  }

  const paramsSearch = new URLSearchParams({
    token: token,
    cnpj: cnpj,
    data_inicio: dataInicio,
    data_fim: dataFim,
    timeout: '600',
  });

  const apiRequest = {
    cnpj,
    data_inicio: dataInicio,
    data_fim: dataFim,
    timeout: 600,
    endpoint: INFOSIMPLES_ENDPOINT,
  };

  const doCall = async () => {
    const resp = await fetch(INFOSIMPLES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paramsSearch.toString(),
    });
    const text = await resp.text();
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();
    if (!resp.ok || (json && typeof json.code === 'number' && ![200, 612].includes(json.code))) {
      const err: any = new Error('provider_error');
      err.status = resp.status || 502;
      err.statusText = resp.statusText || 'Bad Gateway';
      err.providerCode = json?.code;
      err.providerMessage = json?.code_message || json?.message || json?.errors?.[0]?.message || null;
      throw err;
    }
    return json;
  };

  const apiResponse = await withRetry(doCall, 3, [1500, 3000, 5000]);
  if (debugMode && apiResponse?.header?.parameters?.token) {
    delete apiResponse.header.parameters.token;
  }

  const headerRequestedAt = apiResponse?.header?.requested_at || requestedAtISO;
  const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
  const perdcompArray = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];
  const resumo = agregaPerdcomp(perdcompArray);
  const first = perdcompArray[0] || {};
  const totalPerdcomp = resumo.total;
  const mappedCount = apiResponse?.mapped_count || totalPerdcomp;
  const siteReceipt = apiResponse?.site_receipts?.[0] || '';

  const card: any = {
    ok: true,
    fonte: 'api:infosimples',
    header: {
      ...(apiResponse?.header ?? {}),
      requested_at: headerRequestedAt,
      cnpj,
      nomeEmpresa,
      clienteId,
    },
    mappedCount,
    total_perdcomp: totalPerdcomp,
    site_receipt: siteReceipt,
    perdcomp: perdcompArray,
    perdcompResumo: resumo,
    perdcompCodigos: perdcompArray
      .map((item: any) => item?.perdcomp)
      .filter(Boolean),
    primeiro: {
      perdcomp: first?.perdcomp,
      solicitante: first?.solicitante,
      tipo_documento: first?.tipo_documento,
      tipo_credito: first?.tipo_credito,
      data_transmissao: first?.data_transmissao,
      situacao: first?.situacao,
      situacao_detalhamento: first?.situacao_detalhamento,
    },
    cnpj,
    clienteId,
    nomeEmpresa,
    empresaId: empresaId ?? null,
  };

  if (debugMode) {
    card.debug = {
      requestedAt: requestedAtISO,
      fonte: 'api:infosimples',
      apiRequest,
      apiResponse,
      mappedCount,
      total_perdcomp: totalPerdcomp,
    };
  }

  const normalizedFacts = normalizePerdcompFacts(perdcompArray, {
    clienteId,
    empresaId,
    nomeEmpresa,
    cnpj,
  });

  return {
    source: 'LIVE',
    card,
    facts: normalizedFacts,
    meta: {
      dataConsultaISO: headerRequestedAt,
      urlComprovante: siteReceipt || undefined,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    const rawCnpj = body?.cnpj ?? url.searchParams.get('cnpj') ?? '';
    const cnpj = normalizeCNPJ(rawCnpj);
    if (!isValidCNPJ(cnpj)) {
      return NextResponse.json(
        { error: true, httpStatus: 400, httpStatusText: 'Bad Request', message: 'CNPJ inválido' },
        { status: 400 },
      );
    }

    let data_fim = (body?.data_fim ?? url.searchParams.get('data_fim') ?? '').toString().slice(0, 10);
    let data_inicio = (body?.data_inicio ?? url.searchParams.get('data_inicio') ?? '').toString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) {
      data_inicio = addYears(data_fim, -5);
    }

    const force = Boolean(body?.force ?? false);
    const debugMode = Boolean(body?.debug ?? false);

    const clienteIdInput =
      body?.Cliente_ID ??
      body?.clienteId ??
      url.searchParams.get('Cliente_ID') ??
      url.searchParams.get('clienteId');
    const nomeEmpresa =
      body?.Nome_da_Empresa ??
      body?.nomeEmpresa ??
      url.searchParams.get('Nome_da_Empresa') ??
      url.searchParams.get('nomeEmpresa');
    const empresaId =
      body?.Empresa_ID ??
      body?.empresaId ??
      url.searchParams.get('Empresa_ID') ??
      url.searchParams.get('empresaId');

    if (!clienteIdInput || !nomeEmpresa) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const requestedAtISO = new Date().toISOString();
    const consultaId = randomUUID();

    console.info('FLOW_START', {
      clienteIdInput,
      refazer: force,
      cnpj,
    });

    const resolvedClienteId = await resolveClienteId({
      providedClienteId: clienteIdInput,
      cnpj,
    });

    const { source, card, facts, meta } = await pickPerdecompSource({
      refazer: force,
      clienteId: resolvedClienteId,
      cnpj,
      nomeEmpresa,
      empresaId: empresaId ?? null,
      dataInicio: data_inicio,
      dataFim: data_fim,
      debugMode,
      requestedAtISO,
    });

    console.info('FLOW_BUILT', {
      clienteIdResolved: resolvedClienteId,
      factsLen: Array.isArray(facts) ? facts.length : 0,
      source,
    });

    const renderedAtISO = new Date().toISOString();
    await savePerdecompResults({
      clienteId: resolvedClienteId,
      empresaId: empresaId ?? undefined,
      cnpj,
      card,
      facts: Array.isArray(facts) ? facts : [],
      meta: {
        fonte: source === 'LIVE' ? 'api:infosimples' : 'snapshot:reuse',
        dataConsultaISO: meta?.dataConsultaISO ?? requestedAtISO,
        urlComprovante: meta?.urlComprovante,
        cardSchemaVersion: CARD_SCHEMA_VERSION,
        renderedAtISO,
        consultaId,
      },
    });

    return NextResponse.json(card);
  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    const status = error?.status ?? 502;
    const statusText = error?.statusText ?? 'Bad Gateway';
    return NextResponse.json(
      {
        error: true,
        httpStatus: status,
        httpStatusText: statusText,
        providerCode: error?.providerCode ?? null,
        providerMessage: error?.providerMessage ?? error?.message ?? 'API error',
      },
      { status },
    );
  }
}
