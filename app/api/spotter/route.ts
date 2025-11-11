// app/api/spotter/route.ts
import { NextResponse } from "next/server";

/**
 * Proxy para o Exact Spotter.
 * Ajusta o encoding do $filter para evitar '+' (quebra no OData).
 * Mantém 'funnels' como recebido (';'-separado).
 * Respostas de erro são saneadas para não vazar detalhes sensíveis.
 */

type JsonOk<T> = { ok: true; data: T };
type JsonErr = { ok: false; error: string };

export const revalidate = 60;

function ensureEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const resource = incoming.searchParams.get("resource");
  const funnels = incoming.searchParams.get("funnels");
  const filter = incoming.searchParams.get("filter");

  if (!resource) {
    return NextResponse.json<JsonErr>(
      { ok: false, error: "Missing query param: resource" },
      { status: 400 }
    );
  }

  // Base/Token do Spotter
  let base: string;
  let token: string;
  try {
    base = ensureEnv("SPOTTER_API_BASE"); // ex: https://api.exactspotter.com/v3
    token = ensureEnv("SPOTTER_TOKEN");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<JsonErr>({ ok: false, error: msg }, { status: 500 });
  }

  // Monta a URL upstream
  const upstream = new URL(
    `${base.replace(/\/+$/, "")}/${resource.replace(/^\//, "")}`
  );

  // 'funnels' vai direto (já vem '22783;22784', que o backend entende)
  if (funnels) upstream.searchParams.set("funnels", funnels);

  // Para $filter, NÃO usar searchParams.set (converte espaço em '+')
  // Anexar manualmente usando encodeURIComponent no valor (gera %20).
  if (filter) {
    const enc = encodeURIComponent(filter);
    const hasQuery = upstream.search.length > 0;
    upstream.search = (hasQuery ? upstream.search + "&" : "?") + `$filter=${enc}`;
  }

  try {
    const resp = await fetch(upstream.toString(), {
      headers: { token_exact: token },
      cache: "no-store",
    });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!resp.ok) {
      let body: unknown = undefined;
      if (isJson) {
        try {
          body = await resp.json();
        } catch {
          body = { message: "Upstream returned invalid JSON body" };
        }
      } else {
        try {
          const text = await resp.text();
          body = { message: text.slice(0, 500) };
        } catch {
          body = { message: "Upstream error without readable body" };
        }
      }

      const status = [401, 403, 404, 429, 500, 502, 503].includes(resp.status)
        ? resp.status
        : 502;

      return NextResponse.json<JsonErr>(
        {
          ok: false,
          error:
            `Upstream Spotter error (status ${resp.status})` +
            (isJson ? "" : " - non JSON body"),
        },
        { status }
      );
    }

    if (!isJson) {
      return NextResponse.json<JsonErr>(
        { ok: false, error: "Upstream returned non-JSON response" },
        { status: 502 }
      );
    }

    const data = (await resp.json()) as unknown;
    return NextResponse.json<JsonOk<unknown>>(
      { ok: true, data },
      { headers: { "X-Proxy": "spotter" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<JsonErr>({ ok: false, error: msg }, { status: 500 });
  }
}
