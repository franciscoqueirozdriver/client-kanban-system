import { BundleResponse, BundleResponse as BundleT } from "@/lib/schemas/spotter";
import { safeFetchJSON } from "@/lib/http/safeFetchJSON";

export type MetricsDTO = { hasPartialData: boolean; /* ...cards/gráficos */ };

export async function loadMetrics(params: { funnels: number[]; fromISO?: string }): Promise<MetricsDTO> {
  const funnels = params.funnels.join(";");
  const filter = params.fromISO ? `registerDate ge ${params.fromISO}` : undefined;
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/api/spotter`);
  url.searchParams.set("resource", "Bundle");
  url.searchParams.set("funnels", funnels);
  if (filter) url.searchParams.set("filter", filter);

  try {
    const { ok, data, error } = await safeFetchJSON<{ ok: boolean; data?: unknown; error?: string }>(url.toString());
    if (!ok || !data) throw new Error(error ?? "Upstream error");

    const parsed = BundleResponse.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.message);

    // TODO: mapear para DTO dos cards/gráficos usados no dashboard
    return { hasPartialData: false, cards: [], graphs: [] };
  } catch (err) {
    console.error("[loadMetrics] fallback:", err);
    return { hasPartialData: true, cards: [], graphs: [] };
  }
}
