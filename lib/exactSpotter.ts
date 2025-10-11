import { getSpotterToken } from './spotter-env';
import { joinUrl } from './url.js';

export const SPOTTER_BASE_URL =
  (process.env.EXACT_SPOTTER_BASE_URL || 'https://api.exactspotter.com/v3').replace(/\/+$/, '');

type HeadersLike = HeadersInit | undefined;

function mergeHeaders(extra: HeadersLike): HeadersInit {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    token_exact: getSpotterToken(),
  };
  if (!extra) return base;
  // normaliza HeadersInit para objeto simples
  if (extra instanceof Headers) {
    extra.forEach((v, k) => { base[k] = v; });
    return base;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) base[k] = v as string;
    return base;
  }
  return { ...base, ...extra };
}

async function spotterFetch(url: string, options: RequestInit = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: mergeHeaders(headers),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // A specific check for the 404 on /Leads to give a better error message
    if (res.status === 404 && url.includes('/Leads')) {
        throw new Error(`Spotter 404: O endpoint /Leads não foi encontrado. Verifique o EntitySet correto no $metadata da sua conta.`);
    }
    throw new Error(`Spotter ${res.status}: ${txt || res.statusText}`);
  }

  // Handle 201 Created with empty body, which is common
  if (res.status === 201 || res.status === 204) {
    return { ok: true, status: res.status };
  }

  return res.json().catch(() => ({ ok: true, status: res.status, data: {} }));
}


export async function spotterPost(entitySet: string, payload: any) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] POST →', url);
  }
  return spotterFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function spotterGet(entitySet: string) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] GET →', url);
  }
  return spotterFetch(url, { method: 'GET' });
}

export async function spotterMetadata() {
  const token = getSpotterToken();
  if (!token) {
    throw new Error('Token do Spotter ausente');
  }
  const url = joinUrl(SPOTTER_BASE_URL, '$metadata');
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] GET →', url);
  }
  const res = await fetch(url, { headers: { token_exact: token } });
   if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`$metadata ${res.status}: ${txt || res.statusText}`);
  }
  return res.text();
}