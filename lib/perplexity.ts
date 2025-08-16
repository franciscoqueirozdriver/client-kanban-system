// lib/perplexity.ts

// --- Interfaces ---

export interface CompanySuggestion {
  Nome_da_Empresa: string;
  Site_Empresa: string;
  País_Empresa: string;
  Estado_Empresa: string;
  Cidade_Empresa: string;
  Logradouro_Empresa: string;
  Numero_Empresa: string;
  Bairro_Empresa: string;
  Complemento_Empresa: string;
  CEP_Empresa: string;
  CNPJ_Empresa: string;
  DDI_Empresa: string;
  Telefones_Empresa: string;
  Observacao_Empresa: string;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// --- Constants ---

const DEFAULT_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3-sonar-large-32k-online'; // Using a powerful model as requested
const DEFAULT_TIMEOUT = 20000; // Increased timeout for potentially long lookups

// --- Private Helper Functions ---

/**
 * Fetches data from ViaCEP API.
 */
async function lookupCep(rawCep: string): Promise<ViaCepResponse | null> {
  const digits = String(rawCep || '').replace(/\D+/g, '');
  if (digits.length !== 8) {
    return null;
  }
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data.erro) {
      return null;
    }
    return data;
  } catch (error) {
    console.error('ViaCEP lookup failed', error);
    return null;
  }
}

/**
 * Calls the Perplexity API with a given prompt.
 */
async function callPerplexity(
  prompt: string,
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT,
  endpoint: string = DEFAULT_ENDPOINT,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const body = {
    model,
    messages: [{ role: 'system', content: 'Você é um assistente que retorna dados estruturados.' },{ role: 'user', content: prompt }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Perplexity API error: ${res.status}`, errorBody);
      throw new Error(`Perplexity API error: ${res.status}`);
    }
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes a CNPJ string to 14 digits.
 */
function normalizeCnpj(cnpj: string | undefined | null): string {
  return String(cnpj || '').replace(/\D+/g, '');
}

/**
 * Parses the Perplexity response (expected as JSON) and maps it to our structure.
 */
function parseAndMapResponse(responseText: string): Partial<CompanySuggestion> {
  try {
    // Perplexity might return a JSON object wrapped in markdown
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : responseText;
    const parsed = JSON.parse(jsonString);

    // Map the parsed data to the CompanySuggestion interface
    const suggestion: Partial<CompanySuggestion> = {
      Nome_da_Empresa: parsed.nome_empresa,
      Site_Empresa: parsed.site,
      País_Empresa: parsed.endereco?.pais,
      Estado_Empresa: parsed.endereco?.estado,
      Cidade_Empresa: parsed.endereco?.cidade,
      Logradouro_Empresa: parsed.endereco?.logradouro,
      Numero_Empresa: parsed.endereco?.numero,
      Bairro_Empresa: parsed.endereco?.bairro,
      Complemento_Empresa: parsed.endereco?.complemento,
      CEP_Empresa: parsed.endereco?.cep,
      CNPJ_Empresa: normalizeCnpj(parsed.cnpj),
      DDI_Empresa: parsed.telefones?.ddi,
      Telefones_Empresa: parsed.telefones?.numeros?.join('; '),
      Observacao_Empresa: parsed.observacao,
    };

    // Clean up undefined values
    return Object.fromEntries(Object.entries(suggestion).filter(([_, v]) => v != null));
  } catch (error) {
    console.error('Failed to parse Perplexity response:', error);
    return {};
  }
}


// --- Public-facing Function ---

/**
 * Enriches company data using the Perplexity API.
 * @param input - An object containing the company name and optional CNPJ.
 * @returns A promise that resolves to a partial CompanySuggestion object.
 */
export async function enrichCompanyData(input: {
  nome: string;
  cnpj?: string;
}): Promise<Partial<CompanySuggestion>> {
  const { nome, cnpj } = input;

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    // In a real app, you'd throw an error that the API can catch and return a 500.
    // For this context, returning an error message in the object might be more graceful for the UI.
    console.error('PERPLEXITY_API_KEY is not set.');
    throw new Error('A chave da API da Perplexity não está configurada no servidor.');
  }

  const prompt = `
    Por favor, encontre informações detalhadas sobre a empresa brasileira com o nome "${nome}"${cnpj ? ` e CNPJ (se possível, confirme se é o mesmo) "${cnpj}"` : ''}.
    Busque o site oficial, endereço completo da sede (logradouro, número, bairro, cidade, estado, CEP, país), telefone(s) com DDI, e o CNPJ principal.
    Forneça um parágrafo curto de observação sobre a empresa (máximo 280 caracteres).

    Retorne a resposta estritamente como um objeto JSON com a seguinte estrutura, sem nenhum texto ou formatação adicional:

    \`\`\`json
    {
      "nome_empresa": "Nome Oficial da Empresa",
      "site": "https://www.siteoficial.com.br",
      "cnpj": "XX.XXX.XXX/XXXX-XX",
      "endereco": {
        "logradouro": "Rua Exemplo",
        "numero": "123",
        "complemento": "Sala 45",
        "bairro": "Centro",
        "cidade": "São Paulo",
        "estado": "SP",
        "cep": "01000-000",
        "pais": "Brasil"
      },
      "telefones": {
        "ddi": "+55",
        "numeros": ["(11) 99999-9999", "(11) 8888-8888"]
      },
      "observacao": "Breve resumo sobre a área de atuação e porte da empresa."
    }
    \`\`\`
    `;

  try {
    const responseText = await callPerplexity(prompt, apiKey);
    const suggestions = parseAndMapResponse(responseText);

    // If CEP is found, optionally verify/enrich address with ViaCEP
    if (suggestions.CEP_Empresa) {
      const cepData = await lookupCep(suggestions.CEP_Empresa);
      if (cepData) {
        // Only override if the original suggestion was empty
        suggestions.Logradouro_Empresa = suggestions.Logradouro_Empresa || cepData.logradouro;
        suggestions.Bairro_Empresa = suggestions.Bairro_Empresa || cepData.bairro;
        suggestions.Cidade_Empresa = suggestions.Cidade_Empresa || cepData.localidade;
        suggestions.Estado_Empresa = suggestions.Estado_Empresa || cepData.uf;
      }
    }

    // Ensure CNPJ is just digits if present
    if (suggestions.CNPJ_Empresa) {
        suggestions.CNPJ_Empresa = normalizeCnpj(suggestions.CNPJ_Empresa);
    }


    return suggestions;
  } catch (error) {
    console.error('Error during company enrichment:', error);
    // Depending on desired behavior, re-throw or return a specific error object
    throw error;
  }
}
