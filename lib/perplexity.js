// lib/perplexity.js
// Integração Perplexity com resposta em TABELA Markdown.
// Robustez:
// 1) Prompt pede TABELA (campos fixos).
// 2) Parse da tabela -> objeto normalizado.
// 3) Se vier texto/sem tabela, tenta extrair CNPJ via regex.
// 4) Se ainda não houver CNPJ, faz 2ª chamada focada só no CNPJ da MATRIZ (0001).
// 5) DDI = '55' apenas se houver telefone; senão, vazio.
// 6) Timeout ajustável: PERPLEXITY_TIMEOUT_MS (default 10000).

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
Preciso dos dados cadastrais completos da empresa ${nome}, apresentados exclusivamente em formato de tabela (Markdown), contendo os seguintes campos, nesta ordem:

| Nome da Empresa | Site Empresa | País Empresa | Estado Empresa | Cidade Empresa | Logradouro Empresa | Número Empresa | Bairro Empresa | Complemento Empresa | CEP Empresa | CNPJ Empresa | DDI Empresa | Telefones Empresa | Observação Empresa |

Caso não encontrar o(s) telefone(s) da empresa, deixe o campo 'DDI Empresa' em branco.
Busque informações apenas em fontes oficiais, como Receita Federal, site da empresa, consulta CNPJ e bases empresariais para garantir precisão.
A resposta deve ser apenas a TABELA, sem nenhum texto adicional antes ou depois.
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

// ==================== Parsers ====================
function extractCNPJFromText(text) {
  const candidates = String(text).match(/\b\d{2}\.?\d{3}\.?\d{3}\/??\d{4}-?\d{2}\b/g) || [];
  for (const c of candidates) {
    const fixed = normalizeCNPJ(c);
    if (fixed) return fixed;
  }
  const c2 = String(text).match(/\b\d{14}\b/);
  if (c2) {
    const fixed = normalizeCNPJ(c2[0]);
    if (fixed) return fixed;
  }
  return '';
}

function headerToKey(h) {
  const s = norm(h).toLowerCase();
  if (s === 'nome da empresa') return 'nome';
  if (s === 'site empresa') return 'site';
  if (s === 'país empresa' || s === 'pais empresa') return 'pais';
  if (s === 'estado empresa') return 'estado';
  if (s === 'cidade empresa') return 'cidade';
  if (s === 'logradouro empresa') return 'logradouro';
  if (s === 'número empresa' || s === 'numero empresa') return 'numero';
  if (s === 'bairro empresa') return 'bairro';
  if (s === 'complemento empresa') return 'complemento';
  if (s === 'cep empresa') return 'cep';
  if (s === 'cnpj empresa') return 'cnpj';
  if (s === 'ddi empresa') return 'ddi';
  if (s === 'telefones empresa') return 'telefone';
  if (s === 'observação empresa' || s === 'observacao empresa') return 'observacao';
  return '';
}

function parseMarkdownTableToObject(md) {
  const lines = String(md).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // encontra primeira linha com '|' e a linha separadora logo abaixo (---)
  let headerLineIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\|/.test(lines[i]) && /^(\|?\s*:?-{3,}.*)+\|?$/.test(lines[i + 1])) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx < 0) return null;

  const headerCells = lines[headerLineIdx]
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length);

  const dataStart = headerLineIdx + 2;
  if (dataStart >= lines.length) return null;

  const rowCells = lines[dataStart]
    .split('|')
    .map(c => c.trim());

  const obj = {};
  for (let i = 0; i < headerCells.length && i < rowCells.length; i++) {
    const key = headerToKey(headerCells[i]);
    if (!key) continue;
    obj[key] = rowCells[i] || '';
  }
  return obj;
}

// ==================== HTTP ====================
async function callPerplexity(prompt, signal) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY ausente no .env.local');

  const body = {
    model: PPLX_MODEL,
    temperature: 0,
    top_p: 1,
    // Não forçamos response_format aqui porque queremos TABELA Markdown.
    messages: [
      { role: 'system', content: 'Responda estritamente conforme solicitado.' },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch(PPLX_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Perplexity API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ==================== API principal ====================
export async function enrichCompanyData(empresa) {
  // Se já houver CNPJ normalizável, NÃO chama a AI.
  const base = { ...empresa, pais: 'Brasil' };
  const fixedAlready = normalizeCNPJ(base.cnpj || '');
  if (fixedAlready) return sanitizeBrazilFields({ ...base, cnpj: fixedAlready });

  const nome = norm(base.nome);
  if (!nome) return sanitizeBrazilFields(base);

  // 1) Chamada com TABELA
  let enriched = {};
  try {
    const content = await withTimeout((signal) => callPerplexity(buildFullPrompt(base), signal), TIMEOUT_MS);

    // Tenta parsear tabela
    const parsed = parseMarkdownTableToObject(content);
    if (parsed) {
      enriched = onlyAllowedKeys(parsed);
    } else {
      // Sem tabela — tentar extrair CNPJ do texto
      const cnpjFromText = extractCNPJFromText(content);
      enriched = onlyAllowedKeys({});
      if (cnpjFromText) enriched.cnpj = cnpjFromText;
    }
  } catch (err) {
    console.error('Perplexity (tabela) falhou:', err?.message || err);
    enriched = {};
  }

  // 2) Se ainda não tem CNPJ, 2ª chamada “CNPJ only”
  let fixedCNPJ = normalizeCNPJ(enriched.cnpj || '');
  if (!fixedCNPJ) {
    try {
      const content2 = await withTimeout((signal) => callPerplexity(buildCNPJOnlyPrompt(base), signal), TIMEOUT_MS);
      // Nessa segunda, pode vir JSON ou texto; tentar ambos:
      try {
        const i = content2.indexOf('{'), j = content2.lastIndexOf('}');
        const jsonStr = i >= 0 && j >= 0 ? content2.slice(i, j + 1) : '';
        if (jsonStr) {
          const obj = JSON.parse(jsonStr);
          fixedCNPJ = normalizeCNPJ(obj?.cnpj || '');
        }
      } catch { /* ignora e tenta regex */ }
      if (!fixedCNPJ) fixedCNPJ = normalizeCNPJ(extractCNPJFromText(content2));
    } catch (err) {
      console.error('Perplexity (CNPJ-only) falhou:', err?.message || err);
    }
  }

  if (!fixedCNPJ) {
    // Sem CNPJ: devolve base sanitizada; o endpoint chamador pode retornar 422.
    return sanitizeBrazilFields(base);
  }

  enriched.cnpj = fixedCNPJ;
  let merged = mergeIfEmpty(base, enriched);
  merged = sanitizeBrazilFields(merged);
  return merged;
}

async function withTimeout(fn, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try { return await fn(controller.signal); }
  finally { clearTimeout(id); }
}
