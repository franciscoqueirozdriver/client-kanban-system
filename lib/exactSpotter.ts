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
  const token = getSpotterToken();
  if (!token) {
    throw new Error('Token do Spotter ausente');
  }
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: mergeHeaders(headers),
    cache: 'no-store',
  });
  return res;
}

export async function spotterPost(entitySet: string, payload: any) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] POST →', url);
  }
  const res = await spotterFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Spotter ${res.status}: ${txt || res.statusText}`);
  }
  return res.json().catch(() => ({ ok: true, status: res.status, data: {} }));
}

export async function spotterGet(entitySet: string) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] GET →', url);
  }
  const res = await spotterFetch(url, { method: 'GET' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Spotter ${res.status}: ${txt || res.statusText}`);
  }
  return res.json().catch(() => ({ ok: true, status: res.status, data: {} }));
}

export async function spotterMetadata() {
  const url = joinUrl(SPOTTER_BASE_URL, '$metadata');
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] GET →', url);
  }
  const res = await spotterFetch(url, { headers: { token_exact: getSpotterToken() } });
   if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`$metadata ${res.status}: ${txt || res.statusText}`);
  }
  return res.text();
}

export type SpotterFunnel = { id: number; value: string; active: boolean };
export type SpotterStage = { id: number; value: string; funnelId: number; active: boolean; position: number; gateType: number };

export async function listFunnels(): Promise<SpotterFunnel[]> {
  const res = await spotterFetch(joinUrl(SPOTTER_BASE_URL, 'funnels'));
  if (!res.ok) throw new Error(`FUNNELS_HTTP_${res.status}`);
  const data = await res.json();
  return (data?.value ?? []) as SpotterFunnel[];
}

export async function listStages(): Promise<SpotterStage[]> {
  const res = await spotterFetch(joinUrl(SPOTTER_BASE_URL, 'stages'));
  if (!res.ok) throw new Error(`STAGES_HTTP_${res.status}`);
  const data = await res.json();
  return (data?.value ?? []) as SpotterStage[];
}

