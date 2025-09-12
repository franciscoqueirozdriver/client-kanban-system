import { joinUrl } from './url.js';
import { normalizePhoneList } from '../utils/telefone.js';

export const normalizePhonesList = normalizePhoneList;

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

function resolveEntityUrlFromHeaders(res) {
  const loc =
    res.headers.get('Location') ||
    res.headers.get('location') ||
    res.headers.get('OData-EntityId') ||
    res.headers.get('odata-entityid');
  if (!loc) return null;
  return /^https?:\/\//i.test(loc) ? loc : joinUrl(SPOTTER_BASE_URL, loc);
}

export async function spotterPostAndFetch(entitySet, payload) {
  const url = joinUrl(SPOTTER_BASE_URL, entitySet);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Spotter] POST →', url);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      token: TOKEN,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  const status = res.status;
  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    throw new Error(`Spotter ${status}: ${text || res.statusText}`);
  }

  if (json && typeof json === 'object' && Object.keys(json).length) {
    return { status, entityUrl: null, entity: json, raw: text };
  }

  const entityUrl = resolveEntityUrlFromHeaders(res);
  if (entityUrl) {
    const g = await fetch(entityUrl, {
      headers: { token: TOKEN, Accept: 'application/json' },
    });
    const entity = await g.json().catch(() => ({}));
    return { status, entityUrl, entity, raw: null };
  }

  return { status, entityUrl: null, entity: null, raw: text || null };
}

export async function spotterGetByFilter(entitySet, odataFilter, top = 1) {
  const url = joinUrl(
    SPOTTER_BASE_URL,
    `${entitySet}?$top=${top}&$filter=${encodeURIComponent(odataFilter)}`
  );
  const res = await fetch(url, {
    headers: { token: TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET Spotter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const value = Array.isArray(data?.value) ? data.value : [];
  return value;
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
