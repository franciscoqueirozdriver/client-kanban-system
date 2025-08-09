// Library for enriching company data using the Perplexity API
// This file exposes `enrichCompanyData` which retrieves structured
// information about a company and parses it into our internal format.

const API_URL = 'https://api.perplexity.ai/chat/completions';

/** Normalise a string removing accents and trimming spaces */
function norm(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Build the full prompt for the initial company lookup */
export function buildFullPrompt(empresa) {
  const nome = empresa?.nome || '';
  return `
Preciso dos dados cadastrais completos da empresa ${nome}, apresentados exclusivamente em formato de tabela (Markdown), contendo os seguintes campos, nesta ordem:

| Nome da Empresa | Site Empresa | País Empresa | Estado Empresa | Cidade Empresa | Logradouro Empresa | Número Empresa | Bairro Empresa | Complemento Empresa | CEP Empresa | CNPJ Empresa | DDI Empresa | Telefones Empresa | Observação Empresa |

Regra para "Observação Empresa": escreva 1–2 frases objetivas (atividade, porte, ano de fundação, etc.) e inclua ao final uma fonte/URL curta.
Caso não encontrar o(s) telefone(s), deixe o campo 'DDI Empresa' em branco.
Busque apenas fontes oficiais (Receita Federal, site da empresa, consulta CNPJ e bases empresariais confiáveis).
Responda apenas com a TABELA, sem texto extra antes ou depois.
`.trim();
}

/** Map a header string to our object keys */
export function headerToKey(h) {
  const s = norm(h);
  if (s === 'nome da empresa' || s === 'nome empresa' || s === 'nome') return 'nome';
  if (s === 'site da empresa' || s === 'site empresa' || s === 'site') return 'site';
  if (s === 'pais empresa' || s === 'pais da empresa' || s === 'pais') return 'pais';
  if (s === 'estado empresa' || s === 'estado da empresa' || s === 'estado') return 'estado';
  if (s === 'cidade empresa' || s === 'cidade da empresa' || s === 'cidade') return 'cidade';
  if (s === 'logradouro empresa' || s === 'logradouro da empresa' || s === 'logradouro') return 'logradouro';
  if (s === 'numero empresa' || s === 'número empresa' || s === 'numero') return 'numero';
  if (s === 'bairro empresa' || s === 'bairro da empresa' || s === 'bairro') return 'bairro';
  if (s === 'complemento empresa' || s === 'complemento da empresa' || s === 'complemento') return 'complemento';
  if (s === 'cep empresa' || s === 'cep da empresa' || s === 'cep') return 'cep';
  if (s === 'cnpj empresa' || s === 'cnpj da empresa' || s === 'cnpj') return 'cnpj';
  if (s === 'ddi empresa' || s === 'ddi da empresa' || s === 'ddi') return 'ddi';
  if (s === 'telefones empresa' || s === 'telefone empresa' || s === 'telefone') return 'telefone';
  // Variations for "Observação Empresa"
  if (
    s === 'observação empresa' ||
    s === 'observacao empresa' ||
    s === 'observações empresa' ||
    s === 'observacoes empresa' ||
    s === 'observação' ||
    s === 'observacao' ||
    s === 'descricao' ||
    s === 'descrição' ||
    s === 'resumo'
  )
    return 'observacao';
  return null;
}

/** Restrict an object to allowed keys */
function onlyAllowedKeys(obj) {
  const allowed = new Set([
    'nome',
    'site',
    'pais',
    'estado',
    'cidade',
    'logradouro',
    'numero',
    'bairro',
    'complemento',
    'cep',
    'cnpj',
    'ddi',
    'telefone',
    'telefone2',
    'observacao',
  ]);
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (allowed.has(k) && obj[k]) out[k] = String(obj[k]).trim();
  }
  return out;
}

/** Parse a Markdown table and return an object with mapped headers */
export function parseMarkdownTableToObject(markdown) {
  if (!markdown) return null;
  const rows = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  if (rows.length < 2) return null;
  const header = rows[0]
    .split('|')
    .slice(1, -1)
    .map((h) => h.trim());

  // find first data line after separator
  let dataLine = null;
  for (let i = 1; i < rows.length; i++) {
    if (!/^\|\s*-/.test(rows[i])) {
      dataLine = rows[i];
      break;
    }
  }
  if (!dataLine) return null;

  const cells = dataLine
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

  const obj = {};
  header.forEach((h, i) => {
    const key = headerToKey(h);
    if (!key) return;
    const value = cells[i] || '';
    if (key === 'telefone') {
      const phones = value
        .split(/[,/]|\s+e\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);
      obj.telefone = phones[0] || '';
      if (phones[1]) obj.telefone2 = phones[1];
    } else {
      obj[key] = value;
    }
  });

  return obj;
}

/** Extract a short observation sentence and URL as fallback */
export function extractObservationFallback(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();

  // pega a primeira URL
  const urlMatch = text.match(/\bhttps?:\/\/[^\s)]+/i);
  const url = urlMatch ? urlMatch[0] : '';

  // tenta achar uma frase curta útil (até 180 chars)
  let sentence = '';
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length) {
    sentence = sentences[0];
    if (sentence.length > 180) sentence = sentence.slice(0, 177) + '...';
  }

  if (!sentence && url) sentence = 'Fonte consultada.';

  const out = sentence && url ? `${sentence} ${url}` : (sentence || url || '');
  // limitar tamanho final ~240 chars
  return out.length > 240 ? out.slice(0, 237) + '...' : out;
}

/** Query the Perplexity API */
async function callPerplexity(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'sonar-small-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Enrich company data using Perplexity */
export async function enrichCompanyData(empresa) {
  let enriched = { ...empresa };

  try {
    const content = await callPerplexity(buildFullPrompt(empresa));
    const parsed = parseMarkdownTableToObject(content);
    if (parsed) {
      enriched = { ...enriched, ...onlyAllowedKeys(parsed) };
    } else {
      // tentativa de extração simples de CNPJ
      const cnpjMatch = content.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
      if (cnpjMatch) enriched.cnpj = cnpjMatch[0];
    }

    // Se a tabela foi parseada mas não trouxe observação, gerar fallback com base no conteúdo bruto
    if (parsed && !enriched.observacao) {
      enriched.observacao = extractObservationFallback(content);
    }

    // Quando não há tabela, também gerar fallback
    if (!parsed && !enriched.observacao) {
      enriched.observacao = extractObservationFallback(content);
    }
  } catch (err) {
    console.error('Erro ao consultar Perplexity:', err);
  }

  return enriched;
}

export default enrichCompanyData;

