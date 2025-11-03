/* lib/perplexity.ts
 *
 * Snake_case everywhere.
 * - CompanySuggestion usa chaves snake_case
 * - askPerplexity() continua disponível (resposta textual + fontes)
 * - extractCompanySuggestions() tenta extrair sugestões em JSON do texto retornado
 * - toCompanySuggestion() mapeia camelCase/kebab/etc. para snake_case com segurança
 */

export interface CompanySuggestion {
  /** Nome legal/fantasia da empresa */
  nome_da_empresa: string;
  /** CNPJ apenas números (opcional) */
  cnpj?: string;
  /** Segmento/indústria (opcional) */
  segmento?: string;
  /** Cidade (opcional) */
  cidade?: string;
  /** Estado/UF (opcional, ex.: 'SP') */
  estado?: string;
  /** País (opcional) */
  pais?: string;
  /** Website (opcional) */
  site?: string;
  /** E-mail principal (opcional) */
  email?: string;
}

export interface PerplexityAnswer {
  id: string;
  text: string;
  sources?: Array<{ title?: string; url?: string }>;
}

type Json = unknown;

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeCNPJ(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const onlyDigits = input.replace(/\D+/g, "");
  return onlyDigits.length === 14 ? onlyDigits : undefined;
}

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

/**
 * Tenta “ler” um objeto livre (camelCase/snake/kebab) e convertê-lo em CompanySuggestion (snake_case).
 * Todos os campos são opcionais exceto nome_da_empresa.
 */
export function toCompanySuggestion(input: unknown): CompanySuggestion | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;

  // Aceita variações comuns nos nomes das chaves
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (k in obj) return obj[k];
    }
    return undefined;
  };

  const nome =
    asNonEmptyString(
      pick(
        "nome_da_empresa",
        "nomeDaEmpresa",
        "company_name",
        "companyName",
        "name",
        "razao_social",
        "razaoSocial",
        "fantasia",
        "trade_name",
        "tradeName",
      ),
    ) ?? "";

  const cnpj =
    normalizeCNPJ(pick("cnpj", "CNPJ", "document", "documento", "company_document", "companyDocument")) ??
    undefined;

  const segmento =
    asNonEmptyString(pick("segmento", "industry", "industry_segment", "setor", "categoria")) ?? undefined;

  const cidade = asNonEmptyString(pick("cidade", "city", "municipio")) ?? undefined;

  // estado/UF: normaliza para 2 letras se possível
  let estado = asNonEmptyString(pick("estado", "uf", "state", "region"));
  if (estado) {
    const up = estado.toUpperCase();
    estado = up.length === 2 ? up : up; // se vier por extenso, mantenha como veio; validação adicional pode ser feita fora
  }

  const pais = asNonEmptyString(pick("pais", "country")) ?? undefined;

  const site = asNonEmptyString(pick("site", "website", "url", "homepage")) ?? undefined;

  const email = asNonEmptyString(pick("email", "e_mail", "mail")) ?? undefined;

  if (!nome) return null;

  return {
    nome_da_empresa: nome,
    cnpj,
    segmento,
    cidade,
    estado,
    pais,
    site,
    email,
  };
}

/**
 * Cliente mínimo para a API do Perplexity.
 * Ajuste PERPLEXITY_API_URL/KEY via env.
 */
export async function askPerplexity(query: string): Promise<PerplexityAnswer> {
  const API_URL = assertEnv("PERPLEXITY_API_URL"); // ex.: https://api.perplexity.ai/chat/completions
  const API_KEY = assertEnv("PERPLEXITY_API_KEY");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      // Ajuste para o contrato real do seu endpoint
      model: "sonar-small-online",
      messages: [{ role: "user", content: query }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status} ${res.statusText}: ${txt.slice(0, 300)}`);
  }

  const data: Json = await res.json();

  // Narrowing básico (evita depender de tipos instáveis da API)
  const choices: unknown =
    typeof data === "object" && data !== null && "choices" in data ? (data as any).choices : undefined;

  const content: string =
    Array.isArray(choices) && choices[0]?.message?.content
      ? String(choices[0].message.content)
      : JSON.stringify(data);

  const id: string = typeof (data as any)?.id === "string" ? (data as any).id : "unknown";

  const sources: Array<{ title?: string; url?: string }> | undefined = Array.isArray((data as any)?.sources)
    ? (data as any).sources.map((s: any) => ({
        title: typeof s?.title === "string" ? s.title : undefined,
        url: typeof s?.url === "string" ? s.url : undefined,
      }))
    : undefined;

  return { id, text: content, sources };
}

/**
 * Extrai sugestões de empresas do texto retornado.
 * Estratégia:
 * 1) Busca o primeiro bloco JSON no texto (array ou objeto com uma propriedade array)
 * 2) Converte cada item com toCompanySuggestion()
 */
export function extractCompanySuggestions(answer: PerplexityAnswer): CompanySuggestion[] {
  const text = answer.text ?? "";
  const blocks = findJsonBlocks(text);
  for (const raw of blocks) {
    try {
      const parsed: Json = JSON.parse(raw);

      // Caso 1: seja um array direto
      if (Array.isArray(parsed)) {
        const out = parsed
          .map((x) => toCompanySuggestion(x))
          .filter((x): x is CompanySuggestion => x !== null);
        if (out.length) return out;
      }

      // Caso 2: objeto com propriedade array (ex.: { companies: [...] })
      if (typeof parsed === "object" && parsed !== null) {
        for (const key of Object.keys(parsed as Record<string, unknown>)) {
          const v = (parsed as any)[key];
          if (Array.isArray(v)) {
            const out = v
              .map((x: unknown) => toCompanySuggestion(x))
              .filter((x: CompanySuggestion | null): x is CompanySuggestion => x !== null);
            if (out.length) return out;
          }
        }
      }
    } catch {
      // ignora blocos que não parseiam
    }
  }
  return [];
}

/** Procura trechos que “parecem” JSON no texto (ingênuo, mas útil para LLM output). */
function findJsonBlocks(s: string): string[] {
  const out: string[] = [];
  // tenta capturar blocos entre ```json ... ``` ou apenas o primeiro [ ... ] / { ... }
  const fence = /```json([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(s))) {
    const candidate = m[1].trim();
    if (candidate) out.push(candidate);
  }

  // fallback: tenta achar o primeiro array/objeto parseável
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  const start =
    firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start >= 0) {
    const tail = s.slice(start);
    // heurística: pega até o último '}' ou ']' do texto
    const lastCurly = tail.lastIndexOf("}");
    const lastBracket = tail.lastIndexOf("]");
    const endRel =
    lastCurly === -1 ? lastBracket : lastBracket === -1 ? lastCurly : Math.max(lastCurly, lastBracket);
    if (endRel > 0) {
      const candidate = tail.slice(0, endRel + 1).trim();
      if (candidate) out.push(candidate);
    }
  }
  return out;
}
