// pages/api/companies.js
// Fluxo robusto e rápido:
// - Verifica duplicidade por CNPJ/Nome na aba de importação.
// - Se site estiver vazio, tenta derivar domínio a partir dos e-mails existentes na planilha principal,
//   ignorando domínios genéricos (gmail/outlook/yahoo etc.).
// - Se não houver telefone, deixa DDI vazio.
// - Só chama a Perplexity se NÃO houver CNPJ.

import {
  appendCompanyImportRow,
  getCompanySheetCached,
  getSheetCached,
} from '../../lib/googleSheets';
import { enrichCompanyData } from '../../lib/perplexity';

// ---- DEBUG / LOG ----
const __DEBUG_SHEETS__ = process.env.DEBUG_SHEETS === '1';
function log(...args) { if (__DEBUG_SHEETS__) console.log('[companies]', ...args); }
function warn(...args) { if (__DEBUG_SHEETS__) console.warn('[companies][warn]', ...args); }
function errlog(...args) { console.error('[companies][error]', ...args); }

function safeStr(v, max = 120) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const GENERIC_DOMAINS = new Set([
  'gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com',
  'bol.com.br','uol.com.br','terra.com.br','live.com'
]);

function norm(v) {
  if (v == null) return '';
  return String(v).trim();
}
function ensureHttps(domain) {
  if (!domain) return '';
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}
function extractDomain(email) {
  const m = String(email || '').toLowerCase().match(/^[^@]+@([^@]+)$/);
  return m ? m[1] : '';
}

// Tenta obter domínio corporativo pela planilha principal (Sheet1),
// buscando por colunas de e-mail conhecidas e por nome da organização.
function tryDeriveSiteFromMainSheet(companyName) {
  return getSheetCached()
    .then((sheet) => {
      const rows = sheet.data?.values || [];
      if (!rows.length) return '';
      const [header, ...data] = rows;

      const idxOrgA = header.indexOf('Organização - Nome');
      const idxOrgB = header.indexOf('Negócio - Organização');
      const idxEmailW = header.indexOf('Pessoa - Email - Work');
      const idxEmailH = header.indexOf('Pessoa - Email - Home');
      const idxEmailO = header.indexOf('Pessoa - Email - Other');

      const matches = data.filter((r = []) => {
        const org =
          (idxOrgA >= 0 ? r[idxOrgA] : '') ||
          (idxOrgB >= 0 ? r[idxOrgB] : '');
        return !!org && norm(org).toLowerCase() === norm(companyName).toLowerCase();
      });

      for (const r of matches) {
        const emails = [
          idxEmailW >= 0 ? r[idxEmailW] : '',
          idxEmailH >= 0 ? r[idxEmailH] : '',
          idxEmailO >= 0 ? r[idxEmailO] : '',
        ].filter(Boolean);

        for (const e of emails) {
          const domain = extractDomain(e);
          if (domain && !GENERIC_DOMAINS.has(domain)) {
            return ensureHttps(domain);
          }
        }
      }
      return '';
    })
    .catch(() => '');
}

export default async function handler(req, res) {
  log('incoming method:', req.method);
  if (req.method !== 'POST') return res.status(405).end();

  const { client } = req.body || {};
  log('incoming client keys:', client ? Object.keys(client) : 'none');

  if (!client) return res.status(400).json({ error: 'Client data missing' });

  let empresa = {
    nome: client?.company || '',
    site: client?.website || '',
    pais: client?.country || '',
    estado: client?.state || '',
    cidade: client?.city || '',
    logradouro: client?.address || '',
    numero: client?.number || '',
    bairro: client?.neighborhood || '',
    complemento: client?.complement || '',
    cep: client?.zipcode || '',
    cnpj: client?.cnpj || '',
    ddi: client?.ddi || '',     // regra: só preencher se tiver telefone
    telefone: client?.phone || '',
    telefone2: client?.phone2 || '',
    observacao: client?.observation || '',
  };

  log('empresa.montada', {
    nome: empresa.nome,
    site: empresa.site,
    pais: empresa.pais,
    estado: empresa.estado,
    cidade: empresa.cidade,
    cep: empresa.cep,
    cnpj: empresa.cnpj ? '[present]' : '',
    ddi: empresa.ddi,
    telefone: empresa.telefone ? '[present]' : '',
    telefone2: empresa.telefone2 ? '[present]' : '',
  });

  // 1) Duplicidade na aba de importação (CNPJ ou Nome)
  try {
    const sheet = await getCompanySheetCached();
    const rows = sheet.data?.values || [];
    const [header = [], ...dataRows] = rows;

    const idx = {
      cnpj: header.indexOf('CNPJ Empresa'),
      nome: header.indexOf('Nome da Empresa'),
    };

    const normalize = (v) => (typeof v === 'string' ? v.trim() : v);

    const duplicate = dataRows.some((row = []) => {
      const cnpjVal = idx.cnpj >= 0 ? normalize(row[idx.cnpj]) : '';
      const nomeVal = idx.nome >= 0 ? normalize(row[idx.nome]) : '';
      const sameCnpj = empresa.cnpj && cnpjVal && cnpjVal === normalize(empresa.cnpj);
      const sameNome =
        empresa.nome &&
        nomeVal &&
        nomeVal.toLowerCase() === normalize(empresa.nome).toLowerCase();
      return sameCnpj || sameNome;
    });
    log('duplicidade.indices', idx);
    log('duplicidade.found', duplicate);

    if (duplicate) {
      return res.status(200).json({ duplicate: true });
    }
  } catch (err) {
    console.error('Erro ao verificar duplicidade:', err);
    // segue o fluxo mesmo assim
  }

  // 2) Site por e-mail (fallback): se não veio site, tentar derivar pelo domínio corporativo
  if (!norm(empresa.site) && norm(empresa.nome)) {
    log('site.fallback: tentar derivar pelo domínio de e-mail (planilha principal) para', safeStr(empresa.nome));
    try {
      const derived = await tryDeriveSiteFromMainSheet(empresa.nome);
      if (derived) empresa.site = derived;
      log('site.fallback.result', derived || '(vazio)');
    } catch (_) {}
  }

  // 3) DDI vazio se não houver telefone
  if (!norm(empresa.telefone) && !norm(empresa.telefone2)) {
    empresa.ddi = '';
  }

  // 4) Enriquecer dados COM AI só se NÃO houver CNPJ
  if (!norm(empresa.cnpj)) {
    log('perplexity: iniciando enrichCompanyData (sem CNPJ)');
  } else {
    log('perplexity: pulado (CNPJ presente)');
  }
  try {
    if (!norm(empresa.cnpj) && typeof enrichCompanyData === 'function') {
      empresa = await enrichCompanyData(empresa);
    }
  } catch (err) {
    warn('perplexity.falha', err?.message || err);
    // segue com o que temos
  }

  // 5) Registrar na planilha de importação
  try {
    log('sheets.append: start');
    const result = await appendCompanyImportRow(empresa);
    log('sheets.append: ok', { tableRange: result?.tableRange || null, totalRows: result?.totalRows || null });
    return res.status(200).json({
      success: true,
      tableRange: result?.tableRange || null,
      totalRows: result?.totalRows || null,
    });
  } catch (err) {
    errlog('sheets.append: fail', {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
      data: err?.response?.data,
      stack: err?.stack,
    });
    return res.status(500).json({
      error: 'Erro ao registrar planilha',
      details: err?.response?.data || err?.message || 'unknown',
    });
  }
}
