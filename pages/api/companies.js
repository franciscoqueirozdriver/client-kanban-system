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
  if (req.method !== 'POST') return res.status(405).end();

  const { client } = req.body || {};
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

    if (duplicate) {
      return res.status(200).json({ duplicate: true });
    }
  } catch (err) {
    console.error('Erro ao verificar duplicidade:', err);
    // segue o fluxo mesmo assim
  }

  // 2) Site por e-mail (fallback): se não veio site, tentar derivar pelo domínio corporativo
  if (!norm(empresa.site) && norm(empresa.nome)) {
    try {
      const derived = await tryDeriveSiteFromMainSheet(empresa.nome);
      if (derived) empresa.site = derived;
    } catch (_) {}
  }

  // 3) DDI vazio se não houver telefone
  if (!norm(empresa.telefone) && !norm(empresa.telefone2)) {
    empresa.ddi = '';
  }

  // 4) Enriquecer dados COM AI só se NÃO houver CNPJ
  try {
    if (!norm(empresa.cnpj) && typeof enrichCompanyData === 'function') {
      empresa = await enrichCompanyData(empresa);
    }
  } catch (err) {
    console.error('Falha ao enriquecer dados com Perplexity:', err?.message || err);
    // segue com o que temos
  }

  // 5) Registrar na planilha de importação
  try {
    const result = await appendCompanyImportRow(empresa);
    // Não depender de "updates.updatedRange". Retornar sucesso simples.
    return res.status(200).json({
      success: true,
      tableRange: result?.tableRange || null,
      totalRows: result?.totalRows || null,
    });
  } catch (err) {
    console.error('Erro ao registrar planilha:', {
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
