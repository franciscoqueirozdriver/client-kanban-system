import { randomUUID } from 'crypto';
import { loadSnapshotCard, savePerdecompResults } from '@/lib/perdecomp-persist';
import { onlyDigits, padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import { agregaPerdcomp, parsePerdcompNumero, classificaFamiliaPorNatureza } from '@/utils/perdcomp';

export const PERDECOMP_SHEET_NAME = 'perdecomp';
export const CARD_SCHEMA_VERSION = 'perdecomp-card-v1';

export type PerdcompApiItem = {
  perdcomp?: string;
  cnpj?: string;
  solicitante?: string;
  tipo_documento?: string;
  tipo_credito?: string;
  data_transmissao?: string;
  situacao?: string;
  situacao_detalhamento?: string;
  data_protocolo?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  numero_processo?: string;
  valor?: number | string;
};

export type ProviderError = Error & {
  status?: number;
  statusText?: string;
  providerCode?: number | null;
  providerMessage?: string | null;
};

// --- Helpers ---

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
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(base: number) {
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

function getStatusFromUnknownError(err: unknown): number {
  const asResp = err as { response?: { status?: number } } | undefined;
  const asStatus = err as { status?: number } | undefined;
  return asResp?.response?.status ?? asStatus?.status ?? 0;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delays = [1500, 3000, 5000],
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      console.error('PERDCOMP_API_PROVIDER_ERROR', {
        status: (err as any)?.status,
        providerCode: (err as any)?.providerCode,
        providerMessage: (err as any)?.providerMessage,
      });
      lastErr = err;
      const status = getStatusFromUnknownError(err);
      const shouldRetry = status >= 500 || status === 0;
      if (!shouldRetry || i === attempts - 1) throw err;
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastErr;
}

function normalizeFactValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizePerdcompFacts(
  perdcomp: PerdcompApiItem[],
  {
    clienteId,
    empresaId,
    nomeEmpresa,
    cnpj,
  }: { clienteId: string; empresaId?: string | null; nomeEmpresa?: string | null; cnpj: string },
) {
  return (perdcomp || []).map((item) => {
    const numero = item.perdcomp ?? '';
    const parsed = parsePerdcompNumero(numero);
    const familia = parsed.valido ? classificaFamiliaPorNatureza(parsed.natureza) : 'DESCONHECIDO';

    return {
      Cliente_ID: clienteId,
      Empresa_ID: empresaId ?? '',
      Nome_da_Empresa: nomeEmpresa ?? '',
      CNPJ: cnpj,
      Perdcomp_Numero: normalizeFactValue(item.perdcomp),
      Protocolo: parsed.valido ? normalizeFactValue(parsed.protocolo) : '',
      Natureza: parsed.valido ? normalizeFactValue(parsed.natureza) : '',
      Credito: parsed.valido ? normalizeFactValue(parsed.credito) : '',
      Data_ISO: parsed.valido ? normalizeFactValue(parsed.dataISO) : '',
      Familia: normalizeFactValue(familia),
      Tipo_Documento: normalizeFactValue(item.tipo_documento),
      Tipo_Credito: normalizeFactValue(item.tipo_credito),
      Situacao: normalizeFactValue(item.situacao),
      Situacao_Detalhamento: normalizeFactValue(item.situacao_detalhamento),
      Data_Transmissao: normalizeFactValue(item.data_transmissao),
      Data_Protocolo: normalizeFactValue(item.data_protocolo),
      Periodo_Inicio: normalizeFactValue(item.periodo_inicio),
      Periodo_Fim: normalizeFactValue(item.periodo_fim),
      Numero_Processo: normalizeFactValue(item.numero_processo),
      Valor: normalizeFactValue(item.valor),
      Solicitante: normalizeFactValue(item.solicitante),
    };
  });
}

export async function refreshPerdcompData({
  clienteId,
  cnpj: rawCnpj,
  startDate,
  endDate,
  nomeEmpresa,
}: {
  clienteId: string;
  cnpj: string;
  startDate?: string;
  endDate?: string;
  nomeEmpresa: string;
}) {
  const cnpj = padCNPJ14(rawCnpj);

  if (!clienteId) throw new Error('clienteId required');

  console.info('[perdecomp-service] Refreshing data for', { clienteId, cnpj });

  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
  }

  let data_fim = (endDate || '').toString().slice(0, 10);
  let data_inicio = (startDate || '').toString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
  if (new Date(data_inicio) > new Date(data_fim)) {
    data_inicio = addYears(data_fim, -5);
  }

  const params = new URLSearchParams({
    token,
    cnpj,
    data_inicio,
    data_fim,
    timeout: '600',
  });

  const doCall = async () => {
    const endpoint = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
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
      const err: ProviderError = Object.assign(new Error('provider_error'), {
        status: resp.status || 502,
        statusText: resp.statusText || 'Bad Gateway',
        providerCode: (json?.code as number | undefined) ?? null,
        providerMessage:
          (json?.code_message as string | undefined) ||
          (json?.message as string | undefined) ||
          ((json?.errors?.[0]?.message as string | undefined) ?? null),
      });
      throw err;
    }

    return json as {
      code: number;
      code_message?: string;
      header?: { requested_at?: string; parameters?: { token?: string } };
      data?: Array<{ perdcomp?: PerdcompApiItem[] }>;
      mapped_count?: number;
      site_receipts?: string[];
    };
  };

  const apiResponse = await withRetry(doCall, 3, [1500, 3000, 5000]);

  const headerRequestedAt = apiResponse?.header?.requested_at || new Date().toISOString();
  const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
  const perdcompArray: PerdcompApiItem[] = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];

  const resumo = agregaPerdcomp(perdcompArray);
  const first = perdcompArray[0];
  const totalPerdcomp = resumo.total;
  const mappedCount = apiResponse?.mapped_count ?? totalPerdcomp;
  const siteReceipt = apiResponse?.site_receipts?.[0] || '';

  const resp = {
    ok: true,
    fonte: 'api:infosimples',
    header: {
      requested_at: headerRequestedAt,
      cnpj,
      nomeEmpresa,
      clienteId
    },
    mappedCount,
    total_perdcomp: totalPerdcomp,
    site_receipt: siteReceipt,
    perdcomp: perdcompArray,
    perdcompResumo: resumo,
    perdcompCodigos: perdcompArray.map((item) => item.perdcomp).filter((x): x is string => !!x),
    primeiro: {
      perdcomp: first?.perdcomp,
      solicitante: first?.solicitante,
      tipo_documento: first?.tipo_documento,
      tipo_credito: first?.tipo_credito,
      data_transmissao: first?.data_transmissao,
      situacao: first?.situacao,
      situacao_detalhamento: first?.situacao_detalhamento,
    },
  };

  const consultaId = randomUUID();
  const normalizedFacts = normalizePerdcompFacts(perdcompArray, {
    clienteId,
    empresaId: undefined,
    nomeEmpresa,
    cnpj,
  });

  const snapshotCard = {
    ...resp,
    clienteId,
    nomeEmpresa,
    empresaId: null,
  };

  await savePerdecompResults({
    clienteId,
    empresaId: undefined,
    cnpj,
    card: snapshotCard,
    facts: normalizedFacts,
    meta: {
      fonte: 'api:infosimples',
      dataConsultaISO: headerRequestedAt,
      urlComprovante: siteReceipt || undefined,
      cardSchemaVersion: CARD_SCHEMA_VERSION,
      renderedAtISO: new Date().toISOString(),
      consultaId,
    },
  });

  return resp;
}
