// lib/perplexity.js
// Estratégia anti-ruído para garantir CNPJ:
// 1) Força formato JSON (response_format) na chamada.
// 2) Se vier texto, tenta extrair CNPJ via regex.
// 3) Se seguir sem CNPJ, faz uma 2ª chamada específica: "retorne APENAS o CNPJ da MATRIZ (0001) no Brasil".
// 4) Mantém regra de DDI vazio se não houver telefone.
// 5) Timeout configurável via PERPLEXITY_TIMEOUT_MS (default 10000).

const PPLX_ENDPOINT =
  process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = process.env.PERPLEXITY_MODEL || 'sonar';
const TIMEOUT_MS = parseInt(process.env.PERPLEXITY_TIMEOUT_MS || '10000', 10);

const UF_LIST = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]);

// ==================== Utils ====================
function norm(v) { return v == null ? '' : String(v).trim(); }
function onlyDigits(s) { return norm(s).replace(/\D+/g, ''); }

function onlyAllowedKeys(obj) {
  const allowed = new Set([
    'nome','site','pais','estado','cidade','logradouro','numero','bairro',
    'complemento','cep','cnpj','ddi','telefone','telefone2','observacao'
  ]);
  const out = {};
  for (const k of Object.keys(obj || {})) if (allowed.has(k)) out[k] = norm(obj[k]);
  return out;
}
function mergeIfEmpty(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) if (!out[k] || norm(out[k]) === '') out[k] = v;
  return out;
}

// ==================== Normalizadores BR ====================
function normalizeCNPJ(s) {
  const digits = onlyDigits(s);
  if (digits.length !== 14) return '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
function normalizeCEP(s) {
  const digits = onlyDigits(s);
  if (digits.length !== 8) return '';
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}
function normalizeUF(s) {
  const up = norm(s).toUpperCase();
  return UF_LIST.has(up) ? up : '';
}
function normalizePhoneBR(s) {
  let t = norm(s);
  if (!t) return '';
  t = t.replace(/[^\d+]/g, '');
  if (t.startsWith('55')) t = '+' + t;
  if (!t.startsWith('+55')) t = '+55' + t.replace(/^\+?/, '');
  return t;
}
function preferBRDomain(site) {
  const s = norm(site);
  if (!s) return '';
  const parts = s.split(/\s+|\s*\|\s*/).filter(Boolean);
  if (parts.length <= 1) return s;
  const brFirst =
    parts.find(u => /\.com\.br($|\/)/i.test(u)) ||
    parts.find(u => /\.br($|\/)/i.test(u));
  return brFirst || parts[0];
}
function sanitizeBrazilFields(obj) {
  const out = { ...obj };
  out.pais = 'Brasil';
  const hasPhone = !!norm(out.telefone) || !!norm(out.telefone2);
  out.ddi = hasPhone ? '55' : norm(out.ddi) || '';
  if (out.estado) out.estado = normalizeUF(out.estado);
  if (out.cep) out.cep = normalizeCEP(out.cep);
  if (out.cnpj) out.cnpj = normalizeCNPJ(out.cnpj);
  if (out.site) out.site = preferBRDomain(out.site);
  if (out.telefone) out.telefone = normalizePhoneBR(out.telefone);
  if (out.telefone2) out.telefone2 = normalizePhoneBR(out.telefone2);
  return out;
}

// ==================== Prompts ====================
function buildFullPrompt(empresa) {
  const nome = norm(empresa?.nome);
  return `
Preciso dos dados cadastrais completos da empresa ${nome}, incluindo:

Nome da Empresa
Site Empresa
País Empresa
Estado Empresa
Cidade Empresa
Logradouro Empresa
Número Empresa
Bairro Empresa
Complemento Empresa
CEP Empresa
CNPJ Empresa
DDI Empresa
Telefones Empresa
Observação Empresa

Caso não encontrar o(s) telefone(s) da empresa, pode deixar o campo 'DDI Empresa' em branco também.
Favor buscar fontes oficiais, como Receita Federal, site da empresa, consulta CNPJ e bases empresariais para garantir precisão nas informações.

Responda APENAS com um JSON válido no seguinte formato:

{
  "nome": "",
  "site": "",
  "pais": "",
  "estado": "",
  "cidade": "",
  "logradouro": "",
  "numero": "",
  "bairro": "",
  "complemento": "",
  "cep": "",
  "cnpj": "",
  "ddi": "",
  "telefone": "",
  "observacao": ""
}

- Se não tiver certeza de algum campo, deixe-o como string vazia ("").
- O campo "observacao" deve ser objetivo e incluir uma fonte ou URL quando possível.
`.trim();
}

function buildCNPJOnlyPrompt(empresa) {
  const nome = norm(empresa?.nome);
  const cidade = norm(empresa?.cidade);
  const estado = norm(empresa?.estado);
  const pistas = [];
  if (cidade) pistas.push(`cidade: "${cidade}"`);
  if (estado) pistas.push(`UF: "${estado}"`);

  return `
Retorne APENAS um JSON com o CNPJ (14 dígitos) da MATRIZ (filial 0001) da empresa no BRASIL.
Empresa: "${nome}"${pistas.length ? ` | ${pistas.join(' | ')}` : ''}

Formato:
{ "cnpj": "00.000.000/0001-00" }

- Se houver múltiplos CNPJs, escolha a MATRIZ (0001).
- Se não tiver certeza, responda { "cnpj": "" } sem comentários.
`.trim();
}

// ==================== Helpers de robustez ====================
function extractCNPJFromText(text) {
  // Captura 14 dígitos, opcionalmente formatados.
  const candidates = String(text).match(/\b\d{2}\.?\d{3}\.?\d{3}\/??\d{4}-?\d{2}\b/g) || [];
  for (const c of candidates) {
    const fixed = normalizeCNPJ(c);
    if (fixed) return fixed;
  }
  // Tenta 14 dígitos colados
  const c2 = String(text).match(/\b\d{14}\b/);
  if (c2) {
    const fixed = normalizeCNPJ(c2[0]);
    if (fixed) return fixed;
  }
  return '';
}

// ==================== HTTP calls ====================
async function callPerplexityJSON(prompt, signal) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY ausente no .env.local');

  const body = {
    model: PPLX_MODEL,
    temperature: 0,
    top_p: 1,
    // Muitos provedores compatíveis com OpenAI aceitam response_format;
    // se for ignorado, não quebra.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Responda APENAS com um JSON válido. Não inclua explicações.' },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch(PPLX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Perplexity API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';

  // Tenta achar o primeiro JSON no conteúdo
  const i = content.indexOf('{');
  const j = content.lastIndexOf('}');
  const jsonStr = i >= 0 && j >= 0 ? content.slice(i, j + 1) : content;

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Como fallback, retorna um objeto com o texto bruto para possível regex de CNPJ
    return { __raw__: content };
  }
}

async function withTimeout(fn, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(id);
  }
}

// ==================== API principal ====================
export async function enrichCompanyData(empresa) {
  // Se já houver CNPJ normalizável, NÃO chama a AI.
  const base = { ...empresa, pais: 'Brasil' };
  const fixedAlready = normalizeCNPJ(base.cnpj || '');
  if (fixedAlready) return sanitizeBrazilFields({ ...base, cnpj: fixedAlready });

  const nome = norm(base.nome);
  if (!nome) return sanitizeBrazilFields(base);

  // 1) Chamada completa (todos os campos)
  const fullPrompt = buildFullPrompt(base);
  let enriched = {};
  try {
    const raw = await withTimeout((signal) => callPerplexityJSON(fullPrompt, signal), TIMEOUT_MS);

    // Se veio JSON válido
    if (!raw.__raw__) {
      enriched = onlyAllowedKeys(raw);
    } else {
      // Veio texto; tentar extrair CNPJ
      const cnpjFromText = extractCNPJFromText(raw.__raw__);
      enriched = onlyAllowedKeys({});
      if (cnpjFromText) enriched.cnpj = cnpjFromText;
    }
  } catch (err) {
    console.error('Perplexity (consulta completa) falhou:', err?.message || err);
    enriched = {};
  }

  // 2) Se ainda não tem CNPJ, fazer uma 2ª chamada específica só para CNPJ da MATRIZ
  let fixedCNPJ = normalizeCNPJ(enriched.cnpj || '');
  if (!fixedCNPJ) {
    try {
      const cnpjOnlyPrompt = buildCNPJOnlyPrompt(base);
      const raw2 = await withTimeout((signal) => callPerplexityJSON(cnpjOnlyPrompt, signal), TIMEOUT_MS);

      if (!raw2.__raw__) {
        fixedCNPJ = normalizeCNPJ(raw2.cnpj || '');
      } else {
        fixedCNPJ = normalizeCNPJ(extractCNPJFromText(raw2.__raw__));
      }
    } catch (err) {
      console.error('Perplexity (consulta CNPJ-only) falhou:', err?.message || err);
    }
  }

  if (!fixedCNPJ) {
    // Sem CNPJ: devolve base sanitizada (seu endpoint pode retornar 422 no final)
    return sanitizeBrazilFields(base);
  }

  enriched.cnpj = fixedCNPJ;
  let merged = mergeIfEmpty(base, enriched);
  merged = sanitizeBrazilFields(merged);
  return merged;
}

