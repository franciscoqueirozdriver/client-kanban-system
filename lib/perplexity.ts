// lib/perplexity.ts
import { isCnpj, onlyDigits } from '@/utils/cnpj';
export type CompanySuggestion = {
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
  CNPJ_Empresa?: string;
  DDI_Empresa?: string;
  Telefones_Empresa?: string;
  Observacao_Empresa?: string;
  Nome_Contato?: string;
  Email_Contato?: string;
  Cargo_Contato?: string;
  DDI_Contato?: string;
  Telefones_Contato?: string;
  Mercado?: string;
  Produto?: string;
  Area?: string;
};

const digits = (s?: string) => (s || '').replace(/\D/g, '');

function normalizeUF(uf?: string) {
  const u = (uf || '').trim().toUpperCase();
  return u.length === 2 ? u : '';
}
function normalizePhones(s?: string) {
  const raw = (s || '')
    .replace(/['"]/g, '')
    .split(/[;,/]| ou /i)
    .map(t => t.trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(raw)).map(t => {
    const d = digits(t);
    if (!d) return '';
    return d.startsWith('55') ? `+${d}` : `+55${d}`;
  }).filter(Boolean);
  return uniq.join('; ');
}

function flatten(parsed: any): Partial<CompanySuggestion> {
  const Empresa   = parsed?.Empresa   || {};
  const Contato   = parsed?.Contato   || {};
  const Comercial = parsed?.Comercial || {};
  const out: Partial<CompanySuggestion> = {
    ...Empresa, ...Contato, ...Comercial,
  };
  if (out.CNPJ_Empresa) out.CNPJ_Empresa = digits(out.CNPJ_Empresa);
  if (out.Estado_Empresa) out.Estado_Empresa = normalizeUF(out.Estado_Empresa);
  if (out.Telefones_Empresa) out.Telefones_Empresa = normalizePhones(out.Telefones_Empresa);
  if (out.Telefones_Contato) out.Telefones_Contato = normalizePhones(out.Telefones_Contato);
  if (out.DDI_Empresa && !out.DDI_Empresa.startsWith('+')) out.DDI_Empresa = `+${digits(out.DDI_Empresa) || '55'}`;
  if (out.DDI_Contato && !out.DDI_Contato.startsWith('+')) out.DDI_Contato = `+${digits(out.DDI_Contato) || '55'}`;
  if (!out.Pais_Empresa) out.Pais_Empresa = 'Brasil';
  return out;
}

export async function enrichCompanyData(
  input: { nome?: string; cnpj?: string }
): Promise<{ suggestion: Partial<CompanySuggestion>, debug: any }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const endpoint = process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
  const model    = process.env.PERPLEXITY_MODEL   || 'sonar';
  const temperature = 0.2;

  const nome = (input?.nome || '').trim();
  const cnpj = digits(input?.cnpj);

  const prompt = `
Você é um assistente de extração de dados. Busque informações sobre a empresa brasileira com o nome "${nome}"${cnpj ? ` e CNPJ "${cnpj}"` : ''}.
Responda ESTRITAMENTE com um único objeto JSON no formato:

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
    "Complemento_Empresa": "",
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

Regras importantes:
- O campo "CNPJ_Empresa" é obrigatório. Faça o seu melhor para encontrá-lo.
- Se, após uma busca exaustiva, o CNPJ não for encontrado, retorne "CNPJ_Empresa": "" (uma string vazia). Não invente um número.
- Sem comentários, sem Markdown, sem \`\`\`.
  `.trim();

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: 'Responda apenas com um JSON válido único. Sem texto adicional.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const rawText = await resp.text().catch(() => '');
  if (!resp.ok) {
    throw new Error(`Perplexity falhou: ${resp.status} ${rawText.slice(0, 200)}`);
  }

  let apiJson: any = {};
  try { apiJson = JSON.parse(rawText); } catch {}
  const content: string =
    apiJson?.choices?.[0]?.message?.content ??
    rawText;

  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/```json\s*([\s\S]*?)```/i);
    const js = m ? m[1] : content;
    try { parsed = JSON.parse(js); } catch { parsed = {}; }
  }

  const suggestion = flatten(parsed);

  return {
    suggestion,
    debug: {
      endpoint, model, temperature,
      promptPreview: prompt.slice(0, 1000),
      rawContent: content,
      parsedJson: parsed,
      flattened: suggestion,
    }
  };
}

export async function findCompetitors(input: { nome: string; max?: number }): Promise<{ items: Array<{ nome: string; cnpj: string }>, debug?: any }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const endpoint = process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
  const model    = process.env.PERPLEXITY_MODEL   || 'sonar';
  const temperature = 0.2;

  const nome = (input?.nome || '').trim();
  const max  = Math.min(Math.max(input?.max ?? 20, 1), 20);

  const userPrompt = `
Liste os ${max} principais concorrentes da empresa "${nome}" no Brasil.
Retorne ESTRITAMENTE um array JSON de objetos no formato:
[
  {"nome": "<Nome oficial completo da empresa>", "cnpj": "<apenas números com 14 dígitos do CNPJ MATRIZ; se não encontrado ou inválido, use \"\">"}
]

Regras IMPORTANTES:
- Busque o CNPJ da MATRIZ (sede principal), NÃO de filiais.
- O CNPJ da matriz termina com /0001-XX (onde XX são os dígitos verificadores).
- Se a empresa tiver múltiplos CNPJs, use apenas o da matriz.
- NÃO invente CNPJ. Se não encontrar um CNPJ válido de matriz, devolva "".
- Evite duplicações: cada empresa deve aparecer apenas uma vez.
- NÃO inclua a própria empresa "${nome}" na lista de concorrentes.
- NÃO inclua nada além do JSON.
`.trim();

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: 'Responda apenas com um JSON válido (array de objetos), sem texto adicional.' },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const rawText = await resp.text().catch(() => '');
  if (!resp.ok) throw new Error(`Perplexity falhou: ${resp.status} ${rawText.slice(0, 200)}`);

  let apiJson: any = {};
  try { apiJson = JSON.parse(rawText); } catch {}
  const content: string = apiJson?.choices?.[0]?.message?.content ?? rawText;

  let parsed: any = [];
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/```json\s*([\s\S]*?)```/i);
    const js = m ? m[1] : content;
    try { parsed = JSON.parse(js); } catch { parsed = []; }
  }

  const rawList = Array.isArray(parsed) ? parsed : [];
  const seen = new Set<string>();
  const seenCnpjRaiz = new Set<string>(); // Para detectar CNPJs do mesmo grupo empresarial
  const items: Array<{ nome: string; cnpj: string }> = [];

  for (const entry of rawList) {
    const nome = String(entry?.nome ?? '').trim();
    if (!nome) continue;

    let cnpj = onlyDigits(String(entry?.cnpj ?? ''));
    if (cnpj && !isCnpj(cnpj)) {
      cnpj = '';
    }

    // Validar duplicação por nome
    const nomeKey = nome.toLowerCase();
    if (seen.has(nomeKey)) continue;

    // Validar duplicação por CNPJ completo
    if (cnpj) {
      if (seen.has(cnpj)) continue;
      
      // Validar duplicação por CNPJ raiz (8 primeiros dígitos = mesmo grupo empresarial)
      const cnpjRaiz = cnpj.substring(0, 8);
      if (seenCnpjRaiz.has(cnpjRaiz)) {
        console.warn(`[findCompetitors] CNPJ duplicado detectado (mesmo grupo): ${nome} - ${cnpj}`);
        continue; // Pula empresas do mesmo grupo
      }
      
      seen.add(cnpj);
      seenCnpjRaiz.add(cnpjRaiz);
    }

    seen.add(nomeKey);
    items.push({ nome, cnpj });
    if (items.length >= max) break;
  }

  return {
    items,
    debug: { promptPreview: userPrompt.slice(0, 800), rawContent: content, model, temperature }
  };
}


