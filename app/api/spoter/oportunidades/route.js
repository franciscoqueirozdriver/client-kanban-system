import { NextResponse } from "next/server";
import { spotterPost } from '@/lib/exactSpotter';

// Utilitários locais (evita 400 por DTO malformado)
const digits = (s) => (s ?? "").replace(/\D+/g, "");
const clean = (o) =>
  Object.fromEntries(Object.entries(o).filter(([,v]) => v !== undefined && v !== null && v !== ""));

// Fonte única de verdade para pipelines (funis) e etapas
// Se já houver um serviço/rota interna, reaproveite aqui:
async function getPipelinesCached() {
  // Preferir service interno/local que você já usa em /api/spotter/funnels
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/spotter/funnels`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar catálogo de funis/etapas");
  // Espera-se um shape: { pipelines: [{ id, name, stageNames: string[] }] }
  return res.json();
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Coerções mínimas: funnelId (ID numérico), stage (NOME string)
    const funnelId = Number(body?.funnelId);
    const stage = String(body?.stage ?? "").trim();
    if (!Number.isFinite(funnelId)) {
      return NextResponse.json({ error: "funnelId inválido: envie o ID numérico do funil" }, { status: 400 });
    }
    if (!stage) {
      return NextResponse.json({ error: "stage inválido: envie o NOME da etapa (string)" }, { status: 400 });
    }

    // Normalização de telefone (se usuário colou +55 no único campo)
    let phone = digits(body?.phone);
    let ddiPhone = body?.ddiPhone ? digits(body?.ddiPhone) : (phone ? "55" : undefined);
    if (!ddiPhone && phone?.startsWith("55") && phone.length > 11) {
      ddiPhone = "55";
      phone = phone.slice(2);
    }
    if (phone && phone.length >= 10 && phone[0] === "0") phone = phone.slice(1); // remove 0 do DDD

    // Regra de endereço da doc: se informar qualquer parte, exigir state & country
    const addrKeys = ["address","addressNumber","addressComplement","neighborhood","zipcode","city"];
    const anyAddr = addrKeys.some(k => (body?.[k] ?? "") !== "");
    if (anyAddr && (!body?.state || !body?.country)) {
      return NextResponse.json(
        { error: "Endereço parcial: ao informar address/addressNumber/... informe também state e country." },
        { status: 400 }
      );
    }

    // Validação cruzada Funil×Etapa contra catálogo oficial
    const { pipelines } = await getPipelinesCached();
    const pipeline = pipelines.find(p => p.id === funnelId);
    if (!pipeline) {
      return NextResponse.json({ error: `Funil ID ${funnelId} não encontrado no catálogo` }, { status: 400 });
    }
    if (!pipeline.stageNames?.includes(stage)) {
      return NextResponse.json(
        { error: `A etapa "${stage}" não pertence ao funil "${pipeline.name}".` },
        { status: 400 }
      );
    }

    // Montagem do payload exato para LeadsAdd (ID do funil + NOME da etapa)
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
        funnelId,         // <-- ID numérico
        stage,            // <-- NOME da etapa
        customFields: Array.isArray(body?.customFields) ? body.customFields : undefined,
      }),
    });

    // Log seguro para diagnóstico (remover depois que estabilizar)
    console.log("[Spotter][OUT]", JSON.stringify({
      name: payload.lead?.name,
      funnelId, stage,
      phone: phone ? `***${phone.slice(-4)}` : undefined,
      cpfcnpj: payload.lead?.cpfcnpj ? `***${String(payload.lead.cpfcnpj).slice(-4)}` : undefined,
      hasCustomFields: Array.isArray(payload.lead?.customFields) && payload.lead.customFields.length > 0
    }));

    const r = await fetch("https://api.exactspotter.com/v3/LeadsAdd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token_exact": process.env.EXACT_SPOTTER_TOKEN ?? "",
      },
      body: JSON.stringify(payload),
    });

    // Resposta do provider: 201 com { value }
    if (r.status === 201) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json({ createdId: data?.value ?? null }, { status: 201 });
    }

    // Propagar 4xx/5xx do provider sem mascarar como 502 genérico
    const text = await r.text().catch(() => "");
    return NextResponse.json({ error: text || `Provider ${r.status}` }, { status: r.status });
  } catch (e) {
    const reason = e?.message || "Erro inesperado";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}