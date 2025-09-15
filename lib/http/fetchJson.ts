export default async function fetchJson(url: string, options: RequestInit = {}) {
  const opts: RequestInit = {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
    ...options,
  };
  const res = await fetch(url, opts);
  const contentType = res.headers?.get('content-type') || '';
  if (res.status === 401) {
    const err: any = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  if (!contentType.includes('application/json')) {
    throw new Error('Resposta não-JSON recebida');
  }
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data?.error || 'Erro na requisição');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
