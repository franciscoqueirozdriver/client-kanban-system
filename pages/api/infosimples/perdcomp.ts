import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { padCNPJ14 } from '@/utils/cnpj';
import { agregaPerdcomp } from '@/utils/perdcomp';
import { savePerdecompResults, loadSnapshotCard } from '@/lib/perdecomp-persist';

type RetryableFn<T> = () => Promise<T>;

interface InfosimplesPerdcompResponse {
  code: number;
  code_message: string;
  errors?: string[];
  header?: {
    api_version?: string;
    service?: string;
    parameters?: Record<string, unknown>;
    client_name?: string;
    token_name?: string;
    billable?: boolean;
    price?: string;
    requested_at?: string;
    elapsed_time_in_milliseconds?: number;
    remote_ip?: string;
    signature?: string;
  };
  data_count?: number;
  data?: any;
  site_receipts?: string[];
  [key: string]: unknown;
}

async function withRetry<T>(
  fn: RetryableFn<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const { retries = 3, delayMs = 500 } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt += 1;
      const isNetworkError = ['FetchError', 'ECONNRESET', 'ETIMEDOUT'].includes(err?.code);
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const is5xx = typeof status === 'number' && status >= 500 && status < 600;

      if (attempt > retries || (!isNetworkError && !is5xx)) {
        throw err;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

function isProviderError(body: InfosimplesPerdcompResponse): boolean {
  if (typeof body.code !== 'number') return true;
  if (body.code === 200) return false;
  if (body.code >= 600 && body.code <= 799) return true;
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cnpj: rawCnpj, data_inicio, data_fim, force, debug: debugMode, Cliente_ID, nomeEmpresa } = req.body ?? {};
    const cnpj = padCNPJ14(rawCnpj);
    const consultaId = randomUUID();

    if (!force) {
        const snapshotCard = await loadSnapshotCard({ clienteId: Cliente_ID });
        if (snapshotCard) {
            return res.status(200).json({
                ok: true,
                fallback: snapshotCard,
            });
        }
    }

    const apiToken = process.env.INFOSIMPLES_TOKEN;
    if (!apiToken) {
      return res.status(500).json({ error: 'Infosimples API token is not configured' });
    }

    const form = new URLSearchParams();
    if (cnpj) form.set('cnpj', cnpj);
    form.set('token', apiToken);
    form.set('timeout', '300');

    const url = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

    const apiResponse = await withRetry<InfosimplesPerdcompResponse>(async () => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: form.toString(),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const error = new Error(`Infosimples PERDCOMP HTTP error: ${resp.status} ${resp.statusText}`) as any;
        error.status = resp.status;
        error.body = text;
        throw error;
      }

      const body = (await resp.json()) as InfosimplesPerdcompResponse;

      if (isProviderError(body)) {
        const error = new Error(`Infosimples PERDCOMP provider error: code ${body.code} (${body.code_message})`) as any;
        error.status = 200;
        error.providerBody = body;
        throw error;
      }

      return body;
    });

    if (apiResponse.code === 612) {
        return res.status(200).json({
            ok: true,
            fallback: {
              quantidade: 0,
              dcomp: 0,
              rest: 0,
              ressarc: 0,
              canc: 0,
              requested_at: new Date().toISOString(),
              site_receipt: null,
            },
          });
    }

    const perdcompRaw = apiResponse?.data?.[0]?.perdcomp ?? [];
    const perdcompArray = Array.isArray(perdcompRaw) ? perdcompRaw : [];

    const resumo = agregaPerdcomp(perdcompArray);
    const first = perdcompArray[0] ?? null;

    const card = {
      header: {
        cnpj,
        requested_at: apiResponse.header?.requested_at || new Date().toISOString(),
      },
      resumo,
      perdcompResumo: resumo,
      perdcompCodigos: perdcompArray.map(item => item.perdcomp).filter(Boolean),
      site_receipt: apiResponse.site_receipts?.[0] ?? null,
      primeiro: first ? {
        perdcomp: first.perdcomp,
        solicitante: first.solicitante,
        tipo_documento: first.tipo_documento,
        tipo_credito: first.tipo_credito,
        data_transmissao: first.data_transmissao,
        situacao: first.situacao,
        situacao_detalhamento: first.situacao_detalhamento,
      } : null,
    };

    const meta = {
        consultaId,
        fonte: 'infosimples',
        dataConsultaISO: card.header.requested_at,
        urlComprovante: card.site_receipt ?? undefined,
        cardSchemaVersion: 'v1',
        renderedAtISO: new Date().toISOString(),
        clienteId: Cliente_ID ?? null,
        nomeEmpresa: nomeEmpresa ?? null,
    };

    try {
        await savePerdecompResults({
            cnpj: cnpj,
            card,
            facts: perdcompArray,
            meta,
        });
    } catch (err) {
        console.error('[PERDCOMP] Failed to persist results', {
            err,
            cnpj: cnpj,
            consultaId,
        });
    }

    const linhas = [
        {
          URL_Comprovante_HTML: card.site_receipt,
          Data_Consulta: card.header.requested_at,
        },
      ];

      const responseBody: any = {
        ok: true,
        header: {
          requested_at: card.header.requested_at,
          cnpj: cnpj,
        },
        mappedCount: card.perdcompCodigos?.length ?? 0,
        total_perdcomp: resumo.total,
        site_receipt: card.site_receipt,
        perdcompResumo: resumo,
        perdcompCodigos: card.perdcompCodigos,
        linhas,
      };

      if (debugMode) {
        responseBody.debug = {
          apiResponse,
          resumo,
          card,
          meta,
        };
      }

      return res.status(200).json(responseBody);

  } catch (err: any) {
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 502;
    if (err?.providerBody) {
      return res.status(400).json({
        error: 'Infosimples PERDCOMP business error',
        infosimples: err.providerBody,
      });
    }
    return res.status(status).json({
      error: 'Failed to call Infosimples PERDCOMP API',
      message: err?.message ?? 'Unknown error',
    });
  }
}
