/* lib/spotter/api.ts */
type JsonValue = unknown;

export interface PaginatedResponse<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  [k: string]: JsonValue;
}

export interface Lead {
  id?: number;
  leadId?: number;
  // adicione campos que você usa no UI…
  [k: string]: JsonValue;
}

export interface Dataset {
  leads: Lead[];
  leadsSold: Lead[];
  losts: Lead[];
}

const BASE_URL = process.env.SPOTTER_API_BASE?.replace(/\/+$/, "") || "https://api.exactspotter.com/v3";
const TOKEN = process.env.SPOTTER_TOKEN || process.env.token_exact || process.env.TOKEN_EXACT;

/**
 * Monta URL com query params (sem serializar undefined/null).
 */
function buildUrl(path: string, params?: Record<string, any>): string {
  const url = new URL(path.replace(/^\//, ""), BASE_URL + "/");
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function getJson<T = any>(url: string): Promise<T> {
  if (!TOKEN) {
    throw new Error("SPOTTER_TOKEN (ou token_exact) não configurado.");
  }
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "token_exact": TOKEN,
    },
    // Evita cache em rotas serverless quando for métrica “ao vivo”
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotter ${res.status} ${res.statusText} em ${url} :: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * Paginação robusta para endpoints OData do Spotter.
 * - Respeita "@odata.nextLink"
 * - Protege contra loops (maxPages)
 * - Faz log leve (desativável por env)
 */
export async function fetchPaginated<T>(
  path: string,
  params?: Record<string, any>,
  opts?: { maxPages?: number; log?: boolean }
): Promise<T[]> {
  const maxPages = opts?.maxPages ?? 200;
  const doLog = opts?.log ?? (process.env.SPotter_LOG === "true" || process.env.SPOTTER_LOG === "true");

  const out: T[] = [];
  let page = 0;
  let nextUrl: string | null = buildUrl(path, params);

  while (nextUrl && page < maxPages) {
    page += 1;
    if (doLog) console.log(`[Spotter] GET page ${page}: ${nextUrl}`);

    const data: PaginatedResponse<T> = await getJson<PaginatedResponse<T>>(nextUrl);
    const chunk = Array.isArray(data.value) ? data.value : [];
    out.push(...chunk);

    const nl = data["@odata.nextLink"];
    if (typeof nl === "string" && nl.length > 0) {
      // nextLink já vem completo
      nextUrl = nl;
    } else {
      nextUrl = null;
    }
  }

  if (page >= maxPages) {
    console.warn(`[Spotter] Interrompido por maxPages=${maxPages} em ${path}. Registros agregados: ${out.length}`);
  }

  return out;
}

/* Endpoints convenientes ---------------------------------------------- */

export async function getLeads(params?: Record<string, any>) {
  return fetchPaginated<Lead>("/Leads", params);
}

export async function getLeadsSold(params?: Record<string, any>) {
  // Alguns tenants usam "LeadsSold" como coleção de vendas concluídas
  return fetchPaginated<Lead>("/LeadsSold", params);
}

export async function getLosts(params?: Record<string, any>) {
  // Perdas
  return fetchPaginated<Lead>("/Losts", params);
}

/**
 * Dataset principal do dashboard, usado por loadSpotterMetrics().
 * Ajuste os params se precisar filtrar por período/funil.
 */
export async function getSpotterDataset(params?: Record<string, any>): Promise<Dataset> {
  const [leads, leadsSold, losts] = await Promise.all([
    getLeads(params),
    getLeadsSold(params),
    getLosts(params),
  ]);

  return { leads, leadsSold, losts };
}
