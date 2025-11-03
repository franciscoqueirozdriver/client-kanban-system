// TS: sem any; usar generics e unknown->schema
export type SafeFetchOpts = Omit<RequestInit, "signal"> & { timeoutMs?: number };

export async function safeFetchJSON<T>(url: string, opts: SafeFetchOpts = {}): Promise<T> {
  const { timeoutMs = Number(process.env.SPOTTER_TIMEOUT_MS ?? 15000), ...init } = opts;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);

  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      // não usar cache agressivo aqui; o proxy cuidará de revalidate
      next: { revalidate: 0 },
    });

    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} (${ct}) ${text.slice(0, 200)}`);
    }
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(() => "");
      throw new Error(`Non-JSON (${ct}) ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
    const took = Date.now() - started;
    if (took > 5000) console.warn(`[safeFetchJSON] slow request ${took}ms for ${url}`);
  }
}
