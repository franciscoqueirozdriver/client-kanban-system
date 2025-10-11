import { NextResponse } from "next/server";
import https from "https";

const agent = new https.Agent({ keepAlive: true, maxSockets: 50 });

function getSpotterToken() {
  return process.env.SPOTTER_TOKEN || process.env.EXACT_SPOTTER_TOKEN || "";
}

function normalizeFunnelName(input: any) {
  if (typeof input === "string") return input;
  if (input == null) return "";
  return String(input);
}

async function fetchStages(token: string) {
  const response = await fetch("https://api.exactspotter.com/v3/stages", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      token_exact: token,
    },
    agent,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `stages ${response.status}`);
  }

  const json = await response.json().catch(() => ({}));
  const items = Array.isArray(json?.value) ? json.value : Array.isArray(json) ? json : [];
  return items;
}

export async function GET() {
  const token = getSpotterToken();
  if (!token) {
    return NextResponse.json({ error: "SPOTTER_TOKEN missing" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.exactspotter.com/v3/funnels", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        token_exact: token,
      },
      agent,
      cache: "no-store",
    });

    if (response.ok) {
      const json = await response.json().catch(() => ({}));
      const value = Array.isArray(json?.value) ? json.value : Array.isArray(json) ? json : [];
      const normalized = value
        .map((funnel: any) => ({
          id: funnel?.id ?? funnel?.ID ?? funnel?.Id ?? null,
          name: normalizeFunnelName(
            funnel?.name ?? funnel?.value ?? funnel?.Nome ?? funnel?.Name ?? funnel?.descricao ?? funnel?.Descricao,
          ).trim(),
        }))
        .map((funnel) => ({
          id: funnel.id != null ? String(funnel.id) : "",
          name: funnel.name,
        }))
        .filter((funnel) => funnel.id && funnel.name);

      if (normalized.length > 0) {
        return NextResponse.json(normalized);
      }
    }
  } catch (error) {
    // swallow and fallback to stages aggregation
  }

  try {
    const stageItems = await fetchStages(token);
    const map = new Map<string, { id: string; name: string }>();
    for (const stage of stageItems) {
      const funnelId = stage?.funnelId ?? stage?.FunnelId ?? stage?.funilId;
      if (funnelId == null) continue;
      const id = String(funnelId);
      if (!map.has(id)) {
        map.set(id, { id, name: `Funil #${id}` });
      }
    }

    return NextResponse.json(Array.from(map.values()));
  } catch (error: any) {
    return NextResponse.json(
      { error: "funnels upstream", details: error?.message || String(error) },
      { status: 502 },
    );
  }
}
