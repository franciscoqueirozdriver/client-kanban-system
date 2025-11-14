import type { NextApiRequest, NextApiResponse } from 'next';

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
  data?: unknown;
  site_receipts?: string[];
  [key: string]: unknown;
}

/**
 * Retry helper:
 * - Só tenta de novo em erro de rede ou HTTP 5xx.
 * - NÃO faz retry em erro de negócio da Infosimples (code 600–799).
 */
async function withRetry<T>(
  fn: RetryableFn<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const { retries = 3, delayMs = 500 } = options;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt += 1;

      const isNetworkError =
        err?.name === 'FetchError' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT';

      const status = typeof err?.status === 'number' ? err.status : undefined;
      const is5xx = typeof status === 'number' && status >= 500 && status < 600;

      // Só retry em erro de rede ou 5xx
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
  // Exatamente a lógica do exemplo:
  // code 200 = sucesso; 600–799 = erro de negócio
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
    const { cnpj, cpf, perdcomp, timeout } = req.body ?? {};

    if (!cnpj && !cpf && !perdcomp) {
      return res.status(400).json({
        error: 'You must provide at least one of: cnpj, cpf or perdcomp',
      });
    }

    const apiToken = process.env.INFOSIMPLES_TOKEN;
    if (!apiToken) {
      return res
        .status(500)
        .json({ error: 'Infosimples API token is not configured' });
    }

    // Monta o corpo no mesmo formato do exemplo (form-urlencoded)
    const form = new URLSearchParams();

    if (cpf) form.set('cpf', String(cpf));
    if (cnpj) form.set('cnpj', String(cnpj));
    if (perdcomp) form.set('perdcomp', String(perdcomp));

    form.set('token', apiToken);
    // timeout em segundos: a doc usa 300 no exemplo
    form.set('timeout', String(timeout ?? 300));

    const url =
      'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

    const result = await withRetry<InfosimplesPerdcompResponse>(async () => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          // request original usa form, não JSON
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: form.toString(),
      });

      // Se a própria Infosimples responder com HTTP != 200, é erro de transporte
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const error = new Error(
          `Infosimples PERDCOMP HTTP error: ${resp.status} ${resp.statusText}`,
        ) as any;
        error.status = resp.status;
        error.body = text;
        throw error;
      }

      const body = (await resp.json()) as InfosimplesPerdcompResponse;

      // code 200 = ok, 600–799 = erro de negócio
      if (isProviderError(body)) {
        const error = new Error(
          `Infosimples PERDCOMP provider error: code ${body.code} (${body.code_message})`,
        ) as any;
        error.status = 200;
        error.providerBody = body;
        throw error;
      }

      return body;
    });

    // Sucesso: só devolve o JSON da Infosimples
    return res.status(200).json(result);
  } catch (err: any) {
    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 502;

    if (err?.providerBody) {
      // Erro de negócio da Infosimples (code 600–799)
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
