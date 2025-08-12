import { lookupCep } from './cep.js';

const DEFAULT_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'sonar';
const DEFAULT_TIMEOUT = 10000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function callPerplexity(prompt, timeoutMs, endpoint, model, apiKey) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };

  const res = await withTimeout(
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }),
    timeoutMs
  );

  if (!res.ok) {
    throw new Error(`Perplexity API error: ${res.status}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
}

function normalizeCNPJ(cnpj) {
  const digits = String(cnpj || '').replace(/\D+/g, '');
  if (digits.length !== 14) return '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function normalizeCEP(cep) {
  const digits = String(cep || '').replace(/\D+/g, '');
  if (digits.length !== 8) return '';
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

export function normalizeUF(uf) {
  if (!uf) return '';
  const map = {
    AC: 'AC', ACRE: 'AC',
    AL: 'AL', ALAGOAS: 'AL',
    AP: 'AP', AMAPA: 'AP',
    AM: 'AM', AMAZONAS: 'AM',
    BA: 'BA', BAHIA: 'BA',
    CE: 'CE', CEARA: 'CE',
    DF: 'DF', 'DISTRITO FEDERAL': 'DF',
    ES: 'ES', 'ESPIRITO SANTO': 'ES',
    GO: 'GO', GOIAS: 'GO',
    MA: 'MA', MARANHAO: 'MA',
    MT: 'MT', 'MATO GROSSO': 'MT',
    MS: 'MS', 'MATO GROSSO DO SUL': 'MS',
    MG: 'MG', 'MINAS GERAIS': 'MG',
    PA: 'PA', PARA: 'PA',
    PB: 'PB', PARAIBA: 'PB',
    PR: 'PR', PARANA: 'PR',
    PE: 'PE', PERNAMBUCO: 'PE',
    PI: 'PI', PIAUI: 'PI',
    RJ: 'RJ', 'RIO DE JANEIRO': 'RJ',
    RN: 'RN', 'RIO GRANDE DO NORTE': 'RN',
    RS: 'RS', 'RIO GRANDE DO SUL': 'RS',
    RO: 'RO', RONDONIA: 'RO',
    RR: 'RR', RORAIMA: 'RR',
    SC: 'SC', 'SANTA CATARINA': 'SC',
    SP: 'SP', 'SAO PAULO': 'SP',
    SE: 'SE', SERGIPE: 'SE',
    TO: 'TO', TOCANTINS: 'TO',
  };

  const cleaned = String(uf)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return map[cleaned] || '';
}

function normalizeSite(site) {
  if (!site) return '';
  const parts = String(site)
    .split(/[,\s]/)
    .map((s) => s.trim())
    .filter(Boolean);
  parts.sort((a, b) => (b.endsWith('.com.br') ? 1 : 0) - (a.endsWith('.com.br') ? 1 : 0));
  let url = parts[0] || '';
  url = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  return url;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `+${withCountry}`;
}

function normalizeDDI(ddi, phone) {
  if (!phone) return '';
  const digits = String(ddi || '').replace(/\D+/g, '');
  return digits || '55';
}

function parsePhones(value) {
  const phones = String(value || '')
    .split(/[,/;]| ou /)
    .map((p) => p.trim())
    .filter(Boolean);
  return phones;
}

function normalizeEmpty(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\[\]]/g, '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const invalid = new Set([
    '',
    'NAO',
    'NAO INFORMADO',
    'NAO ESPECIFICADO',
    'SEM DADOS',
    'NAO POSSUI',
    'NAO TEM',
    'N/A',
    'NA',
    'NULL',
    '-',
  ]);
  return invalid.has(cleaned) ? '' : String(value).trim();
}

function sanitize(data) {
  const out = { ...data };
  Object.keys(out).forEach((k) => {
    if (typeof out[k] === 'string') out[k] = normalizeEmpty(out[k]);
  });
  const country = String(out.pais || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  out.estado = normalizeUF(out.estado);
  out.cep = normalizeCEP(out.cep);
  out.cnpj = normalizeCNPJ(out.cnpj);
  if (!['BRASIL', 'BRAZIL'].includes(country) || !out.estado) {
    out.cidade = '';
    out.logradouro = '';
    out.numero = '';
    out.bairro = '';
    out.complemento = '';
    out.cep = '';
    out.estado = '';
  }
  out.pais = 'Brasil';
  const phones = parsePhones(out.telefone);
  out.telefone = normalizePhone(phones[0]);
  out.telefone2 = normalizePhone(phones[1]);
  out.ddi = normalizeDDI(out.ddi, out.telefone);
  out.site = normalizeSite(out.site);
  if (!out.telefone) out.ddi = '';
  return out;
}

function parseMarkdownTable(md) {
  const lines = String(md || '')
    .trim()
    .split('\n')
    .filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return null;
  const headers = lines[0]
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  const values = lines[2]
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (headers.length !== values.length) return null;
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i];
  });
  return obj;
}

function mapFromTable(obj) {
  if (!obj) return {};
  return {
    nome: obj['Nome da Empresa'] || '',
    site: obj['Site Empresa'] || '',
    pais: obj['País Empresa'] || obj['Pais Empresa'] || '',
    estado: obj['Estado Empresa'] || '',
    cidade: obj['Cidade Empresa'] || '',
    logradouro: obj['Logradouro Empresa'] || '',
    numero: obj['Número Empresa'] || obj['Numero Empresa'] || '',
    bairro: obj['Bairro Empresa'] || '',
    complemento: obj['Complemento Empresa'] || '',
    cep: obj['CEP Empresa'] || '',
    cnpj: obj['CNPJ Empresa'] || '',
    ddi: obj['DDI Empresa'] || '',
    telefone: obj['Telefones Empresa'] || '',
    observacao: obj['Observação Empresa'] || obj['Observacao Empresa'] || '',
  };
}

export async function enrichCompanyData(empresa) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY ausente no .env.local');
  }
  const endpoint = process.env.PERPLEXITY_ENDPOINT || DEFAULT_ENDPOINT;
  const model = process.env.PERPLEXITY_MODEL || DEFAULT_MODEL;
  const timeout = parseInt(process.env.PERPLEXITY_TIMEOUT_MS || DEFAULT_TIMEOUT, 10);

  if (empresa?.cnpj && normalizeCNPJ(empresa.cnpj)) {
    const sanitized = sanitize({ ...empresa, cnpj: empresa.cnpj });
    if (!sanitized.cnpj) throw new Error('CNPJ inválido');
    return sanitized;
  }

  const queryParts = [empresa?.nome, empresa?.cidade, empresa?.estado, 'Brasil']
    .filter(Boolean)
    .join(', ');

  const tablePrompt = `Considere a empresa ${queryParts} e forneça os dados da sua sede no Brasil. Retorne uma tabela Markdown com as colunas: Nome da Empresa | Site Empresa | País Empresa | Estado Empresa | Cidade Empresa | Logradouro Empresa | Número Empresa | Bairro Empresa | Complemento Empresa | CEP Empresa | CNPJ Empresa | DDI Empresa | Telefones Empresa | Observação Empresa. Use apenas informações do endereço no Brasil e ignore matrizes ou filiais no exterior. A resposta deve ser apenas a tabela, sem nenhum texto adicional.`;
  let tableText = '';
  try {
    tableText = await callPerplexity(tablePrompt, timeout, endpoint, model, apiKey);
  } catch (err) {
    // ignore, we'll fallback to cnpj-only
  }
  const tableObj = parseMarkdownTable(tableText);
  let enriched = mapFromTable(tableObj);

  if (!normalizeCNPJ(enriched.cnpj)) {
    const cnpjPrompt = `Forneça apenas o CNPJ da empresa ${queryParts} da matriz 0001 no Brasil no formato { "cnpj": "00.000.000/0001-00" }. A resposta deve ser apenas esse JSON.`;
    let cnpjText = '';
    try {
      cnpjText = await callPerplexity(cnpjPrompt, timeout, endpoint, model, apiKey);
    } catch {}
    let cnpj = '';
    try {
      cnpj = JSON.parse(cnpjText).cnpj;
    } catch {}
    if (!normalizeCNPJ(cnpj)) {
      const match = cnpjText.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
      if (match) cnpj = match[0];
    }
    enriched.cnpj = cnpj;
  }

  if (!normalizeCNPJ(enriched.cnpj)) {
    throw new Error('CNPJ não encontrado');
  }

  enriched.nome = enriched.nome || empresa?.nome || '';
  enriched.estado = enriched.estado || empresa?.estado || '';
  enriched.cidade = enriched.cidade || empresa?.cidade || '';
  enriched.cep = enriched.cep || empresa?.cep || '';

  enriched.cep = normalizeEmpty(enriched.cep);
  ['logradouro', 'bairro', 'cidade', 'estado', 'complemento'].forEach(
    (k) => (enriched[k] = normalizeEmpty(enriched[k]))
  );

  // Se houver CEP válido, prioriza o uso do ViaCEP para preencher endereço
  if (enriched.cep) {
    try {
      const viaCepData = await lookupCep(enriched.cep);
      enriched.cep = viaCepData.cep;
      enriched.logradouro = viaCepData.logradouro;
      enriched.bairro = viaCepData.bairro;
      enriched.cidade = viaCepData.localidade;
      enriched.estado = viaCepData.uf;
    } catch {
      // ignora falhas na consulta ao ViaCEP
    }
  }

  return sanitize(enriched);
}

