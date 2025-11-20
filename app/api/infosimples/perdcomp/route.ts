import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '@/lib/googleSheets';
import { savePerdecompResults, loadSnapshotCard } from '@/lib/perdecomp-persist';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import {
  agregaPerdcomp,
  classificaFamiliaPorNatureza,
  parsePerdcompNumero,
} from '@/utils/perdcomp';

export const runtime = 'nodejs';

// Modelo mínimo do item retornado pela Infosimples
type PerdcompApiItem = {
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

// Erro enriquecido usado na integração com a Infosimples
type ProviderError = Error & {
  status?: number;
  statusText?: string;
  providerCode?: number | null;
  providerMessage?: string | null;
};

const PERDECOMP_SHEET_NAME = 'perdecomp';
const CARD_SCHEMA_VERSION = 'perdecomp-card-v1';

// Headers exatamente como na linha 1 da aba `perdecomp`
const REQUIRED_HEADERS = [
  'cliente_id',
  'nome_da_empresa',
  'perdcomp_id',
  'cnpj',
  'tipo_pedido',
  'situacao',
  'periodo_inicio',
  'periodo_fim',
  'quantidade_perdcomp',
  'numero_processo',
  'data_protocolo',
  'ultima_atualizacao',
  'quantidade_receitas',
  'quantidade_origens',
  'quantidade_dar_fs',
  'url_comprovante_html',
  'url_comprovante_pdf',
  'data_consulta',
  'tipo_empresa',
  'concorrentes',
  'json_bruto',
  'empresa_id',
  'code',
  'code_message',
  'mapped_count',
  'perdcomp_principal_id',
  'perdcomp_solicitante',
  'perdcomp_tipo_documento',
  'perdcomp_tipo_credito',
  'perdcomp_data_transmissao',
  'perdcomp_situacao',
  'perdcomp_situacao_detalhamento',
  'qtd_perdcomp_dcomp',
  'qtd_perdcomp_rest',
  'qtd_perdcomp_cancel',
  'qtd_perdcomp_ressarc',
];

function columnNumberToLetter(columnNumber: number) {
  let temp;
  let letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

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

// Fallback para a aba principal `perdecomp` já em snake_case
async function getLastPerdcompFromSheet({
  cnpj,
  clienteId,
}: {
  cnpj?: string;
  clienteId?: string;
}) {
  const sheets = await getSheetsClient();

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${PERDECOMP_SHEET_NAME}!1:1`,
  });
  const headers = head.data.values?.[0] || [];
  const col = (name: string) => headers.indexOf(name);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${PERDECOMP_SHEET_NAME}!A2:Z`,
  });
  const rows = resp.data.values || [];

  const idxCliente = col('cliente_id');
  const idxCnpj = col('cnpj');
  const idxQtd = col('quantidade_perdcomp');
  const idxHtml = col('url_comprovante_html');
  const idxData = col('data_consulta');
  const idxQtdDcomp = col('qtd_perdcomp_dcomp');
  const idxQtdRest = col('qtd_perdcomp_rest');
  const idxQtdRessarc = col('qtd_perdcomp_ressarc');
  const idxQtdCancel = col('qtd_perdcomp_cancel');

  const match = rows.find((r) => {
    const rowCliente = idxCliente >= 0 ? r[idxCliente] : undefined;
    const rowCnpj = idxCnpj >= 0 ? (r[idxCnpj] || '').replace(/\D/g, '') : '';
    return (clienteId && rowCliente === clienteId) || (cnpj && rowCnpj === cnpj);
  });

  if (!match) return null;

  const qtd = idxQtd >= 0 ? Number(match[idxQtd] ?? 0) : 0;
  const dcomp = idxQtdDcomp >= 0 ? Number(match[idxQtdDcomp] ?? 0) : 0;
  const rest = idxQtdRest >= 0 ? Number(match[idxQtdRest] ?? 0) : 0;
  const ressarc = idxQtdRessarc >= 0 ? Number(match[idxQtdRessarc] ?? 0) : 0;
  const canc = idxQtdCancel >= 0 ? Number(match[idxQtdCancel] ?? 0) : 0;

  return {
    quantidade: qtd || 0,
    dcomp,
    rest,
    ressarc,
    canc,
    site_receipt: idxHtml >= 0 ? match[idxHtml] || null : null,
    requested_at: idxData >= 0 ? match[idxData] || null : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    const rawCnpj = body?.cnpj ?? url.searchParams.get('cnpj') ?? '';
    const cnpj = padCNPJ14(rawCnpj);
    if (!isValidCNPJ(cnpj)) {
      console.error('PERDCOMP_API_INVALID_CNPJ', { rawCnpj: rawCnpj, normalized: cnpj });
      return NextResponse.json(
        { error: true, httpStatus: 400, httpStatusText: 'Bad Request', message: 'CNPJ inválido' },
        { status: 400 },
      );
    }

    let data_fim = (body?.data_fim ?? url.searchParams.get('data_fim') ?? '')
      .toString()
      .slice(0, 10);
    let data_inicio = (body?.data_inicio ?? url.searchParams.get('data_inicio') ?? '')
      .toString()
      .slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) {
      data_inicio = addYears(data_fim, -5);
    }

    const force = body?.force ?? false;
    const debugMode = body?.debug ?? false;

    const clienteId =
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

    if (!clienteId || !nomeEmpresa) {
      console.error('PERDCOMP_API_MISSING_FIELDS', {
        clienteId,
        nomeEmpresa,
        bodyKeys: Object.keys(body || {}),
        query: Object.fromEntries(url.searchParams),
      });

      return NextResponse.json(
        {
          error: true,
          httpStatus: 400,
          httpStatusText: 'Bad Request',
          message: 'Missing required fields',
          details: {
            clienteId: !clienteId ? 'required' : 'provided',
            nomeEmpresa: !nomeEmpresa ? 'required' : 'provided',
          },
        },
        { status: 400 },
      );
    }

    const requestedAt = new Date().toISOString();

    const apiRequest = {
      cnpj,
      data_inicio,
      data_fim,
      timeout: 600,
      endpoint: 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp',
    };

    // 1. Tentativa de snapshot antes de chamar API
    if (!force) {
      console.info('SNAPSHOT_MODE', { empresa: nomeEmpresa, clienteId, source: 'perdecomp_snapshot' });

      try {
        const snapshotCard = await loadSnapshotCard({ clienteId });

        if (snapshotCard) {
          console.info('SNAPSHOT_ROWS', {
            empresa: nomeEmpresa,
            clienteId,
            count: Array.isArray(snapshotCard?.perdcomp) ? snapshotCard.perdcomp.length : 0,
          });

          const resumo = snapshotCard?.resumo ?? snapshotCard?.perdcompResumo ?? {};
          const mappedCount =
            snapshotCard?.mappedCount ??
            (Array.isArray(snapshotCard?.perdcomp) ? snapshotCard.perdcomp.length : 0);
          const totalPerdcomp = snapshotCard?.total_perdcomp ?? resumo?.total ?? mappedCount;
          const siteReceipt = snapshotCard?.site_receipt ?? snapshotCard?.header?.site_receipt ?? null;
          const lastConsultation =
            snapshotCard?.header?.requested_at ?? snapshotCard?.requestedAt ?? null;
          const primeiro =
            snapshotCard?.primeiro ??
            (Array.isArray(snapshotCard?.perdcomp) && snapshotCard.perdcomp[0]) ??
            null;
          const perdcompCodigos = snapshotCard?.perdcompCodigos ?? [];

          const resp: Record<string, unknown> = {
            ok: true,
            fonte: 'perdecomp_snapshot',
            mappedCount,
            total_perdcomp: totalPerdcomp,
            perdcompResumo: resumo,
            perdcompCodigos,
            site_receipt: siteReceipt,
            primeiro,
            header: {
              requested_at: lastConsultation,
              cnpj,
              nomeEmpresa,
              clienteId,
            },
            ...snapshotCard,
          };

          if (debugMode) {
            resp.debug = {
              requestedAt,
              fonte: 'perdecomp_snapshot',
              apiRequest,
              apiResponse: null,
              mappedCount,
              header: { requested_at: lastConsultation },
              total_perdcomp: totalPerdcomp,
            };
          }

          return NextResponse.json(resp);
        }
      } catch (error) {
        console.warn('SNAPSHOT_READ_FAIL', {
          clienteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Fallback: planilha perdecomp (snake_case)
      const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
      if (fallback) {
        const { quantidade, dcomp, rest, ressarc, canc, site_receipt, requested_at } = fallback;

        const porFamilia = { DCOMP: dcomp, REST: rest, RESSARC: ressarc, CANC: canc, DESCONHECIDO: 0 };
        const porNaturezaAgrupada = {
          '1.3/1.7': dcomp,
          '1.2/1.6': rest,
          '1.1/1.5': ressarc,
        };
        const total = dcomp + rest + ressarc + canc;

        const resumo = {
          total,
          totalSemCancelamento: quantidade || dcomp + rest + ressarc,
          canc,
          porFamilia,
          porNaturezaAgrupada,
        };

        const resp: Record<string, unknown> = {
          ok: true,
          fonte: 'planilha_fallback',
          perdcompResumo: resumo,
          total_perdcomp: resumo.total,
          perdcompCodigos: [],
          site_receipt,
          header: { requested_at },
        };

        if (debugMode) {
          resp.debug = {
            requestedAt,
            fonte: 'planilha_fallback',
            apiRequest,
            apiResponse: null,
            mappedCount: quantidade,
            header: { requested_at },
            total_perdcomp: resumo.total,
          };
        }

        return NextResponse.json(resp);
      }
    }

    // 2. Chamada à Infosimples
    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) {
      throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
    }

    const params = new URLSearchParams({
      token,
      cnpj,
      data_inicio,
      data_fim,
      timeout: '600',
    });

    const doCall = async () => {
      const resp = await fetch(apiRequest.endpoint, {
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

      // 200 = ok, 612 = "sem dados", mas tratamos como sucesso técnico
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

    let apiResponse: Awaited<ReturnType<typeof doCall>>;
    try {
      apiResponse = await withRetry(doCall, 3, [1500, 3000, 5000]);
    } catch (err: unknown) {
      console.error('PERDCOMP_API_PROVIDER_ERROR', {
        status: (err as any)?.status,
        providerCode: (err as any)?.providerCode,
        providerMessage: (err as any)?.providerMessage,
      });
      const e = err as ProviderError;
      const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
      return NextResponse.json(
        {
          error: true,
          httpStatus: e.status || 502,
          httpStatusText: e.statusText || 'Bad Gateway',
          providerCode: e.providerCode ?? null,
          providerMessage: e.providerMessage ?? e.message ?? 'API error',
          fallback,
        },
        { status: e.status || 502 },
      );
    }

    if (debugMode && apiResponse?.header?.parameters?.token) {
      delete apiResponse.header.parameters.token;
    }

    const headerRequestedAt = apiResponse?.header?.requested_at || requestedAt;

    const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
    const perdcompArray: PerdcompApiItem[] = Array.isArray(perdcompArrayRaw)
      ? perdcompArrayRaw
      : [];

    const resumo = agregaPerdcomp(perdcompArray);
    const first = perdcompArray[0];
    const totalPerdcomp = resumo.total;
    const mappedCount = apiResponse?.mapped_count ?? totalPerdcomp;
    const siteReceipt = apiResponse?.site_receipts?.[0] || '';

    const writes: Record<string, unknown> = {
      code: apiResponse.code,
      code_message: apiResponse.code_message || '',
      mapped_count: mappedCount,
      quantidade_perdcomp: resumo.totalSemCancelamento,
      qtd_perdcomp_dcomp: resumo.porFamilia.DCOMP,
      qtd_perdcomp_rest: resumo.porFamilia.REST,
      qtd_perdcomp_ressarc: resumo.porFamilia.RESSARC,
      qtd_perdcomp_cancel: resumo.porFamilia.CANC,
      url_comprovante_html: siteReceipt,
      data_consulta: headerRequestedAt,
      perdcomp_principal_id: first?.perdcomp || '',
      perdcomp_solicitante: first?.solicitante || '',
      perdcomp_tipo_documento: first?.tipo_documento || '',
      perdcomp_tipo_credito: first?.tipo_credito || '',
      perdcomp_data_transmissao: first?.data_transmissao || '',
      perdcomp_situacao: first?.situacao || '',
      perdcomp_situacao_detalhamento: first?.situacao_detalhamento || '',
    };

    const sheets = await getSheetsClient();

    // Usa getSheetData para pegar headers e linhas já em snake_case
    const { headers, rows } = await getSheetData(PERDECOMP_SHEET_NAME);
    const finalHeaders = [...headers];
    let headerUpdated = false;
    for (const h of REQUIRED_HEADERS) {
      if (!finalHeaders.includes(h)) {
        finalHeaders.push(h);
        headerUpdated = true;
      }
    }

    if (headerUpdated) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: `${PERDECOMP_SHEET_NAME}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [finalHeaders] },
      });
    }

    // procura linha por cliente_id / cnpj já em snake_case
    let rowNumber = -1;
    for (const raw of rows as Array<Record<string, unknown> & { _rowNumber?: number }>) {
      const rowCliente = raw['cliente_id'];
      const rowCnpj = String(raw['cnpj'] ?? '').replace(/\D/g, '');
      if ((clienteId && rowCliente === clienteId) || (cnpj && rowCnpj === cnpj)) {
        rowNumber = raw._rowNumber ?? -1;
        break;
      }
    }

    if (rowNumber !== -1) {
      const data: { range: string; values: unknown[][] }[] = [];
      for (const [key, value] of Object.entries(writes)) {
        if (value === undefined || value === '') continue;
        const colIndex = finalHeaders.indexOf(key);
        if (colIndex === -1) continue;
        const colLetter = columnNumberToLetter(colIndex + 1);
        data.push({
          range: `${PERDECOMP_SHEET_NAME}!${colLetter}${rowNumber}`,
          values: [[value]],
        });
      }
      if (data.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.SPREADSHEET_ID!,
          requestBody: { valueInputOption: 'RAW', data },
        });
      }
    } else {
      const row: Record<string, unknown> = {};
      finalHeaders.forEach((h) => {
        row[h] = '';
      });

      row['cliente_id'] = clienteId;
      row['nome_da_empresa'] = nomeEmpresa;
      row['cnpj'] = `'${cnpj}`;

      for (const [k, v] of Object.entries(writes)) {
        if (v !== undefined) row[k] = v;
      }

      const values = finalHeaders.map((h) => row[h]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: PERDECOMP_SHEET_NAME,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }

    const resp: Record<string, unknown> = {
      ok: true,
      header: { requested_at: headerRequestedAt },
      mappedCount,
      total_perdcomp: totalPerdcomp,
      site_receipt: siteReceipt,
      perdcomp: perdcompArray,
      perdcompResumo: resumo,
      perdcompCodigos: perdcompArray
        .map((item) => item.perdcomp)
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
    };

    if (debugMode) {
      resp.debug = {
        requestedAt,
        fonte: 'api',
        apiRequest,
        apiResponse,
        mappedCount,
        siteReceipts: apiResponse?.site_receipts,
        header: apiResponse?.header,
        total_perdcomp: totalPerdcomp,
        perdcompResumo: resumo,
      };
    }

    const consultaId = randomUUID();
    const normalizedFacts = normalizePerdcompFacts(perdcompArray, {
      clienteId,
      empresaId,
      nomeEmpresa,
      cnpj,
    });

    const snapshotCard = {
      ...resp,
      clienteId,
      nomeEmpresa,
      empresaId: empresaId ?? null,
    };

    await savePerdecompResults({
      clienteId,
      empresaId: empresaId ?? undefined,
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

    return NextResponse.json(resp);
  } catch (error: unknown) {
    console.error('[API /infosimples/perdcomp]', error);
    const e = error as ProviderError;
    return NextResponse.json(
      {
        error: true,
        httpStatus: e.status || 502,
        httpStatusText: e.statusText || 'Bad Gateway',
        providerCode: e.providerCode ?? null,
        providerMessage: e.message || 'API error',
      },
      { status: e.status || 502 },
    );
  }
}
