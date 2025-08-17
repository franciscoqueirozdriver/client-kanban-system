// lib/perplexity.ts

// Mantém a estrutura “achatada” que o modal espera
export type CompanySuggestion = {
  // Empresa
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  Pais_Empresa?: string;
  Estado_Empresa?: string;
  Cidade_Empresa?: string;
  Logradouro_Empresa?: string;
  Numero_Empresa?: string;
  Bairro_Empresa?: string;
  Complemento_Empresa?: string;
  CEP_Empresa?: string;
  CNPJ_Empresa?: string;      // somente dígitos
  DDI_Empresa?: string;       // ex: +55
  Telefones_Empresa?: string; // separados por ;
  Observacao_Empresa?: string;
  // Contato
  Nome_Contato?: string;
  Email_Contato?: string;
  Cargo_Contato?: string;
  DDI_Contato?: string;
  Telefones_Contato?: string; // separados por ;
  // Comercial
  Mercado?: string;
  Produto?: string;
  Area?: string; // JSON keys sem acento
};

function digits(s?: string) {
  return (s || '').replace(/\D/g, '');
}

function withAbortTimeout(ms: number) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

export async function enrichCompanyData(input: { nome?: string; cnpj?: string }): Promise<Partial<CompanySuggestion>> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const nome = (input.nome || '').trim();
  const cnpj = digits(input.cnpj);

  // Prompt enxuto: pedimos APENAS JSON na estrutura esperada
  const system = 'Você responde SOMENTE com um objeto JSON válido, sem texto extra.';
  const user = `
    Extraia dados da empresa brasileira "${nome}"${cnpj ? ` (CNPJ: ${cnpj})` : ''}.
    Retorne APENAS um JSON com esta estrutura e chaves exatas:

    {
      "Empresa": {
        "Nome_da_Empresa": "Nome Oficial Completo",
        "Site_Empresa": "https://site.com.br",
        "Pais_Empresa": "Brasil",
        "Estado_Empresa": "SP",
        "Cidade_Empresa": "São Paulo",
        "Logradouro_Empresa": "Av. Exemplo",
        "Numero_Empresa": "123",
        "Bairro_Empresa": "Centro",
        "Complemento_Empresa": "Andar 10",
        "CEP_Empresa": "01000-000",
        "CNPJ_Empresa": "12345678000199",
        "DDI_Empresa": "+55",
        "Telefones_Empresa": "+55 11 3333-4444; +55 11 98888-7777",
        "Observacao_Empresa": "Breve resumo (≤280 chars)."
      },
      "Contato": {
        "Nome_Contato": "Nome do Contato Principal",
        "Email_Contato": "contato@site.com.br",
        "Cargo_Contato": "Cargo do Contato",
        "DDI_Contato": "+55",
        "Telefones_Contato": "+55 11 99999-0000"
      },
      "Comercial": {
        "Mercado": "Mercado de Atuação",
        "Produto": "Principal Produto/Serviço",
        "Area": "Área (ex: Saúde, Varejo)"
      }
    }
  `.trim();

  const endpoint = process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
  const preferred = process.env.PERPLEXITY_MODEL || 'sonar-pro';
  const models = [preferred, 'sonar']; // fallback automático
  const timeoutMs = Number(process.env.PERPLEXITY_TIMEOUT_MS || 10000);

  let lastErr: any;

  for (const model of models) {
    const { signal, clear } = withAbortTimeout(timeoutMs);
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      clear();

      const data = await resp.json().catch(() => ({} as any));

      if (!resp.ok) {
        const msg = String(data?.error?.message || '');
        // Se o modelo for inválido, tentar o próximo
        if (resp.status === 400 && /invalid model/i.test(msg)) {
          lastErr = data;
          continue;
        }
        throw new Error(`Perplexity falhou: ${resp.status} ${msg || JSON.stringify(data).slice(0, 180)}`);
      }

      // A resposta pode vir em um bloco de código markdown, então extraímos o JSON de dentro.
      const content = data?.choices?.[0]?.message?.content || '{}';
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      const parsed = safeParse(jsonString);
      const empresa = parsed?.Empresa || {};
      const contato = parsed?.Contato || {};
      const comercial = parsed?.Comercial || {};

      const out: Partial<CompanySuggestion> = {
        ...empresa,
        ...contato,
        ...comercial,
        // Garante CNPJ somente dígitos e preserva nome se não vier
        CNPJ_Empresa: digits(empresa?.CNPJ_Empresa || cnpj),
        Nome_da_Empresa: empresa?.Nome_da_Empresa || nome || undefined,
      };

      // Remove chaves vazias/null/undefined
      Object.keys(out).forEach((k) => {
        const v = (out as any)[k];
        if (v == null || String(v).trim() === '') delete (out as any)[k];
      });

      return out;
    } catch (e: any) {
      clear();
      lastErr = e;
    }
  }

  throw new Error(
    `Perplexity falhou: ${typeof lastErr === 'string' ? lastErr : (lastErr?.message || JSON.stringify(lastErr)).slice(0, 200)}`
  );
}
