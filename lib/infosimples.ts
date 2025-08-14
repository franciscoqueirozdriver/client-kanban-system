export async function consultarPerdcomp({ cnpj, timeoutSeconds = 60 }: { cnpj: string; timeoutSeconds?: number }) {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    throw new Error('INFOSIMPLES_TOKEN not configured');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  const params = new URLSearchParams();
  params.set('cnpj', cnpj);
  params.set('token', token);
  params.set('timeout', String(timeoutSeconds));
  try {
    const res = await fetch('https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    const json = await res.json();
    return json;
  } finally {
    clearTimeout(timeout);
  }
}
export default consultarPerdcomp;
