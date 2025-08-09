// lib/perplexity.js
// Enriquecimento focado na MATRIZ NO BRASIL, com UMA ÚNICA consulta à Perplexity.
// Regras de performance:
// - Só consulta a AI se o CNPJ NÃO estiver presente/normalizável.
// - Timeout controlável por env: PERPLEXITY_TIMEOUT_MS (default 10000).
// - Observação deve trazer snapshot econômico conciso e fonte/URL quando possível.
//
// Campos suportados:
// nome, site, pais, estado, cidade, logradouro, numero, bairro, complemento,
// cep, cnpj, ddi, telefone, telefone2, observacao

const PPLX_ENDPOINT =
  process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = process.env.PERPLEXITY_MODEL || 'sonar';
const TIMEOUT_MS = parseInt(process.env.PERPLEXITY_TIMEOUT_MS || '10000', 10);

const UF_LIST = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]);

// ==================== Utils ====================
function norm(v) {
  if (v == null) return '';
  return String(v).trim();
}
function onlyDigits(s) {
  return norm(s).replace(/\D+/g, '');
}
function onlyAllowedKeys(obj) {
  const allowed = new Set([
    'nome','site','pais','estado','cidade','logradouro','numero','bairro',
    'complemento','cep','cnpj','ddi','telefone','telefone2','observacao'
  ]);
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (allowed.has(k)) out[k] = norm(obj[k]);
  }
  return out;
}
function mergeIfEmpty(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    if (!out[k] || norm(out[k]) === '') out[k] = v;
  }
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
  // DDI: só setar "55" se existir telefone/telefone2; caso contrário, manter vazio
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

// ==================== Prompt ====================
function buildCNPJPrompt(empresa) {
  const nome = norm(empresa?.nome);
  const cidade = norm(empresa?.cidade);
  const estado = norm(empresa?.estado);
  const pistas = [];
  if (cidade) pistas.push(`cidade: "${cidade}"`);
  if (estado) pistas.push(`UF: "${estado}"`);
  const hint = pistas.length ? `\nPistas: ${pistas.join(' | ')}` : '';
  return `
Retorne APENAS um JSON válido sobre a empresa no BRASIL.
Dê preferência ao CNPJ da MATRIZ (código 0001). Se não houver 0001, retorne outro CNPJ válido da empresa no Brasil.
Se não tiver certeza do CNPJ, responda cnpj como "" (string vazia). NÃO invente.

Empresa: "${nome}"${hint}

Formato de resposta (JSON estrito):
{
  "cnpj": "00.000.000/0000-00",
  "nome": "",
  "site": "",
  "estado": "",
  "cidade": "",
  "logradouro": "",
  "numero": "",
  "bairro": "",
  "complemento": "",
  "cep": "",
  "telefone": "",
  "telefone2": "",
  "observacao": ""
}

Regras:
- Sempre Brasil (pais="Brasil").
- Não invente: se campo incerto, use "".
- Responda APENAS com o JSON.
- Mantenha "observacao" objetiva (até ~240 caracteres) e inclua uma fonte/URL quando possível.
`.trim();
}

// ==================== HTTP call ====================
async function callPerplexityJSON(prompt, signal) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY ausente no .env.local');

  const body = {
    model: PPLX_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: 'Você responde apenas com JSON válido, sem texto fora do JSON.' },
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

  // Extrai o primeiro objeto JSON (caso venha com algum ruído)
  const i = content.indexOf('{');
  const j = content.lastIndexOf('}');
  const jsonStr = i >= 0 && j >= 0 ? content.slice(i, j + 1) : content;

  return JSON.parse(jsonStr);
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
  if (fixedAlready) {
    const sanitized = sanitizeBrazilFields({ ...base, cnpj: fixedAlready });
    return sanitized;
  }

  const nome = norm(base.nome);
  if (!nome) return sanitizeBrazilFields(base);

  const prompt = buildCNPJPrompt(base);

  let enriched = {};
  try {
    const raw = await withTimeout((signal) => callPerplexityJSON(prompt, signal), TIMEOUT_MS);
    enriched = onlyAllowedKeys(raw);
  } catch (err) {
    console.error('Perplexity (consulta única) falhou:', err?.message || err);
    enriched = {};
  }

  const fixedCNPJ = normalizeCNPJ(enriched.cnpj || '');
  if (!fixedCNPJ) {
    const e = new Error('Nenhum CNPJ encontrado para a empresa no Brasil.');
    e.code = 'CNPJ_NOT_FOUND';
    // Não derrubamos o fluxo: volta sem CNPJ, mas sanitizado
    return sanitizeBrazilFields(base);
  }
  enriched.cnpj = fixedCNPJ;

  let merged = mergeIfEmpty(base, enriched);
  merged = sanitizeBrazilFields(merged);
  return merged;
}

