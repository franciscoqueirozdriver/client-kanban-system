import { joinUrl } from './url.js';

export const SPOTTER_BASE_URL =
  (process.env.EXACT_SPOTTER_BASE_URL || 'https://api.exactspotter.com/v3').replace(/\/+$/, '');

const TOKEN = process.env.EXACT_SPOTTER_TOKEN;
if (!TOKEN) throw new Error('EXACT_SPOTTER_TOKEN ausente');

export async function spotterPost(entitySet, payload) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] POST →', url);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { token: TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Spotter ${res.status}: ${txt || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

export async function spotterMetadata() {
  const url = joinUrl(SPOTTER_BASE_URL, '$metadata');
  const res = await fetch(url, { headers: { token: TOKEN } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`$metadata ${res.status}: ${txt || res.statusText}`);
  }
  return res.text();
}
