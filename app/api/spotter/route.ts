import { NextResponse } from "next/server";
import { safeFetchJSON } from "@/lib/http/safeFetchJSON";

export const revalidate = 60; // cache leve no edge pela rota proxy

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource"); // ex: Bundle
  const funnels = url.searchParams.get("funnels");   // ex: 22783;22784
  const filter = url.searchParams.get("filter");     // ex: registerDate ge 2025-01-01T00:00:00.000Z

  if (!resource) {
    return NextResponse.json({ ok: false, error: "Missing resource" }, { status: 400 });
  }

  const base = process.env.SPOTTER_API_BASE!;
  const token = process.env.SPOTTER_TOKEN!;
  const upstream = new URL(`${base}/${resource}`);

  if (funnels) upstream.searchParams.set("funnels", funnels);
  if (filter)  upstream.searchParams.set("$filter", filter); // o $ será corretamente encodado por searchParams

  try {
    const data = await safeFetchJSON<unknown>(upstream.toString(), {
      headers: { "token_exact": token },
    });
    return NextResponse.json({ ok: true, data }, { headers: { "X-Diag-Trace": "bundle" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Mapeia causas comuns
    const status = /HTTP 401|403/.test(msg) ? 401
                 : /429/.test(msg) ? 429
                 : /Non-JSON/.test(msg) ? 502
                 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: { "X-Diag-Trace": "bundle" } });
  }
}
