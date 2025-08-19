interface PerdcompParams {
  cnpj: string;
  data_inicio?: string;
  data_fim?: string;
  timeout?: number;
}

/**
 * Calls Infosimples PER/DCOMP endpoint (v2) using form-urlencoded body.
 * Throws on non-2xx responses with a truncated body to avoid leaking data.
 */
export async function consultarPerdcomp({
  cnpj,
  data_inicio,
  data_fim,
  timeout = 25,
}: PerdcompParams) {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
  }

  const params = new URLSearchParams();
  params.append('token', token);
  params.append('cnpj', cnpj.replace(/\D/g, ''));
  params.append('timeout', String(timeout));
  if (data_inicio) params.append('data_inicio', data_inicio);
  if (data_fim) params.append('data_fim', data_fim);

  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

  let response: Response;
  try {
    response = await fetch(
      'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal,
      },
    );
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`A consulta à Infosimples excedeu o tempo limite de ${timeout} segundos.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text();
    const truncated = text.length > 300 ? text.slice(0, 300) : text;
    throw new Error(`Infosimples HTTP ${response.status}: ${truncated}`);
  }

  return response.json();
}
