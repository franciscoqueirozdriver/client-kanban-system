// app/api/spotter/route.ts
import { NextResponse } from "next/server";

/**
 * Proxy para o Exact Spotter.
 * - Usa as VARS EXISTENTES: EXACT_SPOTTER_BASE_URL / EXACT_SPOTTER_API_VERSION / EXACT_SPOTTER_TOKEN
 * - Corrige encoding do $filter: usa encodeURIComponent (gera %20, não '+').
 * - Mantém 'funnels' como recebido (';'-separado).
 * - Erros upstream são saneados (sem vazar detalhes sensíveis).
 */

type JsonOk<T> = { ok: true; data: T };
type JsonErr = { ok: false; error: string };

export const revalidate = 60;

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/** Normaliza concatenação de base + versão + resource sem barras duplicadas. */
function joinUrl(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) =>
      i === 0 ? p.replace(/\/+$/g, "") : p.replace(/^\/+/g, "").replace(/\/+$/g, "")
    )
    .join("/");
}

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const resource = incoming.searchParams.get("resource"); // ex: Bundle
  const funnels = incoming.searchParams.get("funnels"); // ex: 22783;22784
  const filter = incoming.searchParams.get("filter"); // ex: registerDate ge 2025-10-12T19:01:43.571Z

  if (!resource) {
    return NextResponse.json<JsonErr>(
      { ok: false, error: "Missing query param: resource" },
      { status: 400 }
    );
  }

  // === VARIÁVEIS EXISTENTES DO PROJETO ===
  // Ex: EXACT_SPOTTER_BASE_URL = https://api.exactspotter.com
  //     EXACT_SPOTTER_API_VERSION = v3
  //     EXACT_SPOTTER_TOKEN = <token>
  let baseUrl: string;
  let apiVersion: string | undefined;
  let token: string;

  try {
    baseUrl = mustEnv("EXACT_SPOTTER_BASE_URL");
    apiVersion = process.env.EXACT_SPOTTER_API_VERSION || undefined;
    token = mustEnv("EXACT_SPOTTER_TOKEN");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<JsonErr>({ ok: false, error: msg }, { status: 500 });
  }

  // Monta URL upstream respeitando base + versão + resource
  // Aceita tanto base já contendo /v3 quanto separada via EXACT_SPOTTER_API_VERSION.
  // Se base já tiver /v3, joinUrl não duplica.
  const upstreamBase = apiVersion ? joinUrl(baseUrl, apiVersion) : baseUrl;
  const upstreamUrl = new URL(joinUrl(upstreamBase, resource));

  // 'funnels' vai direto (o backend entende "22783;22784")
  if (funnels) upstreamUrl.searchParams.set("funnels", funnels);

  // $filter: anexar manualmente com encodeURIComponent para evitar '+'
  if (filter) {
    const enc = encodeURIComponent(filter);
    const hasQuery = upstreamUrl.search.length > 0;
    upstreamUrl.search = (hasQuery ? upstreamUrl.search + "&" : "?") + `$filter=${enc}`;
  }

  try {
    const resp = await fetch(upstreamUrl.toString(), {
      headers: { token_exact: token },
      cache: "no-store",
    });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!resp.ok) {
      // Saneia resposta de erro
      const status = [401, 403, 404, 429, 500, 502, 503].includes(resp.status)
        ? resp.status
        : 502;

      return NextResponse.json<JsonErr>(
        { ok: false, error: `Upstream Spotter error (status ${resp.status})` },
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
