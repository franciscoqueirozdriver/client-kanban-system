import { NextRequest, NextResponse } from 'next/server';

type RetryableFn<T> = () => Promise<T>;

interface InfosimplesPerdcompResponse {
  success?: boolean;
  status?: string;
  error?: string;
  error_code?: number;
  code?: number;
  // outros campos específicos que a API devolve
  [key: string]: unknown;
}

/**
 * Retry helper:
 * - Só faz retry em erro "transitório": HTTP 5xx ou erro de rede.
 * - Não faz retry em erro de negócio (ex.: código 612 no corpo da resposta).
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

      // Só tentamos de novo em erro 5xx ou erro de rede
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
  // Regras de erro de negócio da Infosimples:
  // - error_code / code 612, ou
  // - status === 'error', ou
  // - success === false, ou
  // - campo error preenchido
  if (body.error_code === 612 || body.code === 612) return true;
  if (body.status && body.status.toLowerCase() === 'error') return true;
  if (body.success === false) return true;
  if (typeof body.error === 'string' && body.error.trim().length > 0) return true;
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const payload = await req.json();

    // Ajuste esta montagem conforme o seu contrato real com a Infosimples
    const { cnpj, consulta_id } = payload ?? {};

    if (!cnpj) {
      return NextResponse.json(
        { error: 'cnpj is required' },
        { status: 400 },
      );
    }

    const apiToken = process.env.INFOSIMPLES_TOKEN;
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Infosimples API token is not configured' },
        { status: 500 },
      );
    }

    const url = new URL('https://api.infosimples.com/api/v2/federal/perdcomp');
    url.searchParams.set('token', apiToken);
    url.searchParams.set('cnpj', String(cnpj));
    if (consulta_id) {
      url.searchParams.set('consulta_id', String(consulta_id));
    }

    const result = await withRetry<InfosimplesPerdcompResponse>(async () => {
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      // 1) Erro HTTP puro (não 2xx)
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const error = new Error(
          `Infosimples PERDCOMP HTTP error: ${resp.status} ${resp.statusText}`,
        ) as any;
        error.status = resp.status;
        error.body = text;
        throw error;
      }

      // 2) HTTP 200, mas pode haver erro do provider no body
      const body = (await resp.json()) as InfosimplesPerdcompResponse;

      if (isProviderError(body)) {
        const error = new Error('Infosimples PERDCOMP provider error') as any;
        error.status = 200;
        error.providerBody = body;
        throw error;
      }

      return body;
    });

    // Se chegou aqui, nem HTTP error, nem provider error
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    // Aqui tratamos erro final (depois de todas as tentativas de retry)
    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 502;

    // Se tiver informação de provider no erro, devolvemos isso estruturado
    if (err?.providerBody) {
      return NextResponse.json(
        {
          error: 'Infosimples PERDCOMP provider error',
          details: err.providerBody,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch Infosimples PERDCOMP data',
        message: err?.message ?? 'Unknown error',
      },
      { status },
    );
  }
}
