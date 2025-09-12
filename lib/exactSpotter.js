import { joinUrl } from './url.js';

const DEFAULT_BASE = 'https://api.exactspotter.com/v3';

export const SPOTTER_BASE_URL = (() => {
  const raw = process.env.EXACT_SPOTTER_BASE_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      if (
        url.protocol === 'https:' &&
        url.hostname === 'api.exactspotter.com' &&
        !url.port
      ) {
        const path = url.pathname.replace(/\/+$/, '') || '/v3';
        if (path.startsWith('/v3')) {
          return `${url.origin}${path}`;
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Spotter] ignoring invalid EXACT_SPOTTER_BASE_URL:', raw);
      }
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Spotter] ignoring malformed EXACT_SPOTTER_BASE_URL:', raw);
      }
    }
  }
  return DEFAULT_BASE;
})();

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
