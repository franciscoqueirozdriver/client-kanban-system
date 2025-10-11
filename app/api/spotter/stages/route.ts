import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.SPOTTER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SPOTTER_TOKEN missing" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.exactspotter.com/v3/stages", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        token_exact: token,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "stages upstream", details: text },
        { status: response.status },
      );
    }

    const json = await response.json().catch(() => ({}));
    const items = Array.isArray(json?.value) ? json.value : Array.isArray(json) ? json : [];

    const normalized = items
      .map((stage: any) => ({
        id: stage?.id ?? stage?.ID ?? stage?.Id ?? null,
        name: stage?.value ?? stage?.name ?? stage?.Nome ?? stage?.Name ?? "",
        position: Number(stage?.position ?? stage?.Position ?? 0),
        active: Boolean(stage?.active ?? stage?.Active ?? false),
        funnelId: stage?.funnelId ?? stage?.FunnelId ?? stage?.funilId ?? null,
        gateType: stage?.gateType ?? null,
      }))
      .map((stage) => ({
        id: stage.id != null ? String(stage.id) : "",
        name: typeof stage.name === "string" ? stage.name : stage.name != null ? String(stage.name) : "",
        position: Number.isFinite(stage.position) ? stage.position : 0,
        active: Boolean(stage.active),
        funnelId: stage.funnelId != null ? String(stage.funnelId) : "",
        gateType: stage.gateType ?? null,
      }))
      .filter((stage) => stage.id && stage.name && stage.funnelId);

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json(
      { error: "stages upstream", details: error?.message || String(error) },
      { status: 502 },
    );
  }
}
