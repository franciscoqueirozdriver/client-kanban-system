// lib/perplexity.js
// Enriquecimento focado na MATRIZ NO BRASIL, com fallback para CNPJ-only.
// Logs detalhados para depuração.
// - Apenas consulta a AI se o CNPJ não estiver presente/normalizável.
// - Timeout configurável via PERPLEXITY_TIMEOUT_MS (default 10000).
// - Observação deve trazer snapshot econômico conciso e fonte/URL quando possível.

const PPLX_ENDPOINT =
  process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
const PPLX_MODEL = process.env.PERPLEXITY_MODEL || 'sonar';
const TIMEOUT_MS = parseInt(process.env.PERPLEXITY_TIMEOUT_MS || '10000', 10);
const API_KEY = process.env.PERPLEXITY_API_KEY;
if (!API_KEY) throw new Error('PERPLEXITY_API_KEY ausente no .env.local');

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
    // Always prefer the enriched value if it's not empty.
    if (norm(v) !== '') {
      out[k] = v;
    }
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
const STATE_MAP = {
  'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE',
  'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'GOIÁS': 'GO', 'MARANHÃO': 'MA', 'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG', 'PARÁ': 'PA', 'PARAÍBA': 'PB', 'PARANÁ': 'PR',
  'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS', 'RONDÔNIA': 'RO', 'RORAIMA': 'RR', 'SANTA CATARINA': 'SC',
  'SÃO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO'
};

function normalizeUF(s) {
  const up = norm(s).toUpperCase();
  if (UF_LIST.has(up)) return up; // Already an abbreviation
  return STATE_MAP[up] || ''; // Look up full name
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

  // Stricter DDI validation: only accept short numbers, otherwise use default or empty.
  const ddiLooksValid = /^\+?\d{1,4}$/.test(norm(out.ddi));
  if (hasPhone) {
    out.ddi = ddiLooksValid ? norm(out.ddi) : '55';
  } else {
    out.ddi = '';
  }

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
Preciso dos dados cadastrais completos da empresa ${nome}, apresentados exclusivamente em formato de tabela, contendo os seguintes campos:
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
Caso não encontrar o(s) telefone(s) da empresa, deixe o campo 'DDI Empresa' em branco.
Busque informações apenas em fontes oficiais, como Receita Federal, site da empresa, consulta CNPJ e bases empresariais para garantir precisão.
A resposta deve ser apenas a tabela, sem nenhum texto adicional.
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
  const candidates = String(text).match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) || [];
  // Prioritize Matriz (0001)
  const matriz = candidates.find(c => c.includes('/0001-'));
  if (matriz) {
    const fixed = normalizeCNPJ(matriz);
    if (fixed) return fixed;
  }
  // Fallback to the first found
  if (candidates.length > 0) {
    const fixed = normalizeCNPJ(candidates[0]);
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
  console.log('[perplexity] parser.lines', lines);

  let headerLineIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\|/.test(lines[i]) && /^(\|?\s*:?-{3,}.*)+\|?$/.test(lines[i + 1])) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx < 0) {
    console.warn('[perplexity] tabela.nao_encontrada');
    return null;
  }

  const headerCells = lines[headerLineIdx].split('|').map(c => c.trim()).filter(c => c.length);
  const dataStart = headerLineIdx + 2;
  if (dataStart >= lines.length) {
    console.warn('[perplexity] tabela.sem_linha_de_dados');
    return null;
  }

  const rowCells = lines[dataStart].split('|').map(c => c.trim());

  const obj = {};
  for (let i = 0; i < headerCells.length && i < rowCells.length; i++) {
    const key = headerToKey(headerCells[i]);
    if (!key) continue;
    obj[key] = rowCells[i] || '';
  }
  console.log('[perplexity] parser.obj', obj);
  return obj;
}

// ==================== HTTP ====================
async function callPerplexity(prompt, signal) {
  const body = {
    model: PPLX_MODEL,
    temperature: 0,
    top_p: 1,
    messages: [
      { role: 'system', content: 'Responda estritamente conforme solicitado.' },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch(PPLX_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Perplexity API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  console.log('[perplexity] api.resposta.bruta', content);
  return content;
}

// ==================== API principal ====================
export async function enrichCompanyData(empresa) {
  const base = { ...empresa, pais: 'Brasil' };

  const fixedAlready = normalizeCNPJ(base.cnpj || '');
  if (fixedAlready) {
    const sanitized = sanitizeBrazilFields({ ...base, cnpj: fixedAlready });
    console.log('[perplexity] final.com_cnpj_preexistente', sanitized);
    return sanitized;
  }

  const nome = norm(base.nome);
  if (!nome) {
    const sanitized = sanitizeBrazilFields(base);
    console.log('[perplexity] final.sem_nome', sanitized);
    return sanitized;
  }

  // 1) Chamada com TABELA
  let enriched = {};
  try {
    const content = await withTimeout((signal) => callPerplexity(buildFullPrompt(base), signal), TIMEOUT_MS);

    const parsed = parseMarkdownTableToObject(content);
    if (parsed) {
      enriched = onlyAllowedKeys(parsed);
    } else {
      const cnpjFromText = extractCNPJFromText(content);
      console.log('[perplexity] regex.cnpj.from_full', cnpjFromText);
      enriched = onlyAllowedKeys({});
      if (cnpjFromText) enriched.cnpj = cnpjFromText;
    }
  } catch (err) {
    console.error('[perplexity] consulta.tabela.fail', err?.message || err);
    enriched = {};
  }

  // 2) Se ainda não há CNPJ, 2ª chamada “CNPJ-only”
  let fixedCNPJ = normalizeCNPJ(enriched.cnpj || '');
  if (!fixedCNPJ) {
    try {
      const content2 = await withTimeout((signal) => callPerplexity(buildCNPJOnlyPrompt(base), signal), TIMEOUT_MS);
      console.log('[perplexity] api.resposta.cnpj_only', content2);
      try {
        const i = content2.indexOf('{'), j = content2.lastIndexOf('}');
        const jsonStr = i >= 0 && j >= 0 ? content2.slice(i, j + 1) : '';
        if (jsonStr) {
          const obj = JSON.parse(jsonStr);
          console.log('[perplexity] cnpj_only.json', obj);
          fixedCNPJ = normalizeCNPJ(obj?.cnpj || '');
        }
      } catch (error) {
        console.warn('[perplexity] cnpj_only.json.parse.fail', error?.message || error);
      }
      if (!fixedCNPJ) {
        const rx = extractCNPJFromText(content2);
        console.log('[perplexity] cnpj_only.regex', rx);
        fixedCNPJ = normalizeCNPJ(rx);
      }
    } catch (err) {
      console.error('[perplexity] consulta.cnpj_only.fail', err?.message || err);
    }
  }

  if (!fixedCNPJ) {
    const sanitized = sanitizeBrazilFields(base);
    console.log('[perplexity] final.sem_cnpj', sanitized);
    return sanitized;
  }

  enriched.cnpj = fixedCNPJ;
  let merged = mergeIfEmpty(base, enriched);
  const sanitized = sanitizeBrazilFields(merged);
  console.log('[perplexity] final.com_cnpj', sanitized);
  return sanitized;
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
