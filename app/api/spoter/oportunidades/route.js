import { NextResponse } from "next/server";
import { spotterPost } from '@/lib/exactSpotter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Utilitários locais
const digits = (s) => (s ?? "").replace(/\D+/g, "");
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([,v]) => v !== undefined && v !== null && v !== ""));

// Cache em memória para o catálogo de funis
let _pipelinesCache = null;
async function getPipelinesCached(req) {
  const now = Date.now();
  if (_pipelinesCache && _pipelinesCache.exp > now) return _pipelinesCache.data;

  const url = new URL("/api/spotter/funnels", req.url);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar catálogo de funis/etapas");

  const data = await res.json();
  _pipelinesCache = { data, exp: now + 5 * 60_000 }; // Cache por 5 minutos
  return data;
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Coerções e validações
    const funnelId = Number(body?.funnelId);
    const stage = String(body?.stage ?? "").trim();
    if (!Number.isFinite(funnelId)) {
      return NextResponse.json({ error: "funnelId inválido: envie o ID numérico do funil" }, { status: 400 });
    }
    if (!stage) {
      return NextResponse.json({ error: "stage inválido: envie o NOME da etapa (string)" }, { status: 400 });
    }

    // Normalização de telefone
    let phone = digits(body?.phone);
    let ddiPhone = body?.ddiPhone ? digits(body?.ddiPhone) : (phone ? "55" : undefined);
    if (!ddiPhone && phone?.startsWith("55") && phone.length > 11) {
      ddiPhone = "55";
      phone = phone.slice(2);
    }
    if (phone && phone.length >= 10 && phone[0] === "0") phone = phone.slice(1);

    // Validação de endereço
    const addrKeys = ["address","addressNumber","addressComplement","neighborhood","zipcode","city"];
    if (addrKeys.some(k => (body?.[k] ?? "") !== "") && (!body?.state || !body?.country)) {
      return NextResponse.json(
        { error: "Endereço parcial: ao informar uma parte do endereço, informe também state e country." },
        { status: 400 }
      );
    }

    // Validação cruzada Funil×Etapa
    const { pipelines } = await getPipelinesCached(req);
    const pipeline = pipelines.find(p => p.id === funnelId);
    if (!pipeline) {
      return NextResponse.json({ error: `Funil ID ${funnelId} não encontrado no catálogo` }, { status: 400 });
    }
    const norm = (s) => s.normalize().trim();
    if (!pipeline.stageNames?.map(norm).includes(norm(stage))) {
      return NextResponse.json(
        { error: `A etapa "${stage}" não pertence ao funil "${pipeline.name}".` },
        { status: 400 }
      );
    }

    // Montagem do payload final para Spotter
    const payload = clean({
      duplicityValidation: true,
      lead: clean({
        name: String(body?.name ?? "").trim(),
        industry: body?.industry,
        source: body?.source,
        subSource: body?.subSource,
        organizationId: body?.organizationId,
        sdrEmail: body?.sdrEmail,
        group: body?.group,
        mktLink: body?.mktLink,
        ddiPhone,
        phone,
        ddiPhone2: digits(body?.ddiPhone2),
        phone2: digits(body?.phone2),
        website: body?.website,
        leadProduct: body?.leadProduct,
        address: body?.address,
        addressNumber: body?.addressNumber,
        addressComplement: body?.addressComplement,
        neighborhood: body?.neighborhood,
        zipcode: digits(body?.zipcode),
        city: body?.city,
        state: body?.state,
        country: body?.country,
        cpfcnpj: digits(body?.cpfcnpj),
        description: body?.description,
        funnelId,
        stage,
        customFields: Array.isArray(body?.customFields) ? body.customFields : undefined,
      }),
    });

    // Log seguro
    console.log("[Spotter][OUT]", JSON.stringify({
      name: payload.lead?.name, funnelId, stage,
      phone: phone ? `***${phone.slice(-4)}` : undefined,
      cpfcnpj: payload.lead?.cpfcnpj ? `***${String(payload.lead.cpfcnpj).slice(-4)}` : undefined,
    }));

    // Chamada à API do Spotter
    const r = await fetch("https://api.exactspotter.com/v3/LeadsAdd", {
      method: "POST",
      headers: { "Content-Type": "application/json", "token_exact": process.env.EXACT_SPOTTER_TOKEN ?? "" },
      body: JSON.stringify(payload),
    });

    // Propagação de resposta
    if (r.status === 201) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json({ createdId: data?.value ?? null }, { status: 201 });
    }

    let text = await r.text().catch(() => "");
    try { const j = JSON.parse(text); text = j?.error?.innererror?.message || j?.error?.message || text; } catch {}
    return NextResponse.json({ error: text || `Provider ${r.status}` }, { status: r.status });

  } catch (e) {
    const reason = e?.message || "Erro inesperado";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}