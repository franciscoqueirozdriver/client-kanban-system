import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stagesEndpoint = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/spotter/stages`;
    const response = await fetch(stagesEndpoint, {
      cache: "no-store",
    });

    if (response.ok) {
      const stages = await response.json();
      const stageList: Array<{ funnelId?: string }> = Array.isArray(stages) ? stages : [];
      const map = new Map<string, { id: string; name: string }>();
      for (const stage of stageList) {
        const funnelId = stage?.funnelId ? String(stage.funnelId) : "";
        if (!funnelId) continue;
        if (!map.has(funnelId)) {
          map.set(funnelId, { id: funnelId, name: `Funil #${funnelId}` });
        }
      }
      return NextResponse.json(Array.from(map.values()));
    }

    const token = process.env.SPOTTER_TOKEN;
    if (!token) {
      return NextResponse.json([], { status: 200 });
    }

    const upstream = await fetch("https://api.exactspotter.com/v3/stages", {
      headers: {
        "Content-Type": "application/json",
        token_exact: token,
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const upstreamJson = await upstream.json();
    const upstreamItems: any[] = Array.isArray(upstreamJson?.value)
      ? upstreamJson.value
      : Array.isArray(upstreamJson)
        ? upstreamJson
        : [];
    const ids = Array.from(
      new Set(
        upstreamItems
          .map((stage: any) => stage?.funnelId ?? stage?.FunnelId ?? stage?.funilId)
          .map((id: any) => (id != null ? String(id) : ""))
          .filter((id: string) => Boolean(id)),
      ),
    );

    return NextResponse.json(ids.map((id) => ({ id, name: `Funil #${id}` })));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
