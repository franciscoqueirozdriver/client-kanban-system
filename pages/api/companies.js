import {
  appendCompanyImportRow,
  getCompanySheetCached,
  getSheetCached,
} from '../../lib/googleSheets';
import { enrichCompanyData } from '../../lib/perplexity';

const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'bol.com.br',
  'yahoo.com',
  'outlook.com',
  'live.com',
];

function isValidWebsite(site) {
  if (!site) return false;
  const domain = site
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return domain.includes('.') && !domain.includes('@');
}

function extractDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1];
  if (FREE_EMAIL_DOMAINS.some((d) => domain.endsWith(d))) return null;
  return domain;
}

async function inferWebsiteFromSheet(companyName) {
  try {
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const [header, ...dataRows] = rows;
    const idx = {
      org: header.indexOf('Organização - Nome'),
      work: header.indexOf('Pessoa - Email - Work'),
      home: header.indexOf('Pessoa - Email - Home'),
      other: header.indexOf('Pessoa - Email - Other'),
    };
    if (idx.org < 0) return null;
    const target = (companyName || '').toLowerCase();
    for (const row of dataRows) {
      if (row[idx.org] && row[idx.org].toLowerCase() === target) {
        const emails = [row[idx.work], row[idx.home], row[idx.other]];
        for (const email of emails) {
          const domain = extractDomain(email);
          if (domain) {
            return domain.startsWith('www.') ? domain : `www.${domain}`;
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar domínio por email:', err);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { client } = req.body || {};
  if (!client) {
    return res.status(400).json({ error: 'Client data missing' });
  }

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
    ddi: client?.ddi || '55',
    telefone: client?.phone || '',
    telefone2: client?.phone2 || '',
    observacao: client?.observation || '',
  };

  // verificar duplicidade na planilha
  try {
    const sheet = await getCompanySheetCached();
    const rows = sheet.data.values || [];
    const [header, ...dataRows] = rows;
    const idx = {
      cnpj: header.indexOf('cnpj'),
      nome: header.indexOf('nome'),
    };
    const duplicate = dataRows.some((row) => {
      const cnpjVal = idx.cnpj >= 0 ? row[idx.cnpj] : '';
      const nomeVal = idx.nome >= 0 ? row[idx.nome] : '';
      return (
        (empresa.cnpj && cnpjVal === empresa.cnpj) ||
        (empresa.nome && nomeVal && nomeVal.toLowerCase() === empresa.nome.toLowerCase())
      );
    });
    if (duplicate) {
      return res.status(200).json({ duplicate: true });
    }
  } catch (err) {
    console.error('Erro ao verificar duplicidade:', err);
  }

  // enriquecer dados
  empresa = await enrichCompanyData(empresa);

  if (!isValidWebsite(empresa.site)) {
    const inferred = await inferWebsiteFromSheet(empresa.nome);
    if (inferred) {
      empresa.site = inferred;
    }
  }

  try {
    const appendRes = await appendCompanyImportRow(empresa);
    const range = appendRes.data?.updates?.updatedRange || '';
    const match = range.match(/!(?:[A-Z]+)(\d+):/);
    const row = match ? parseInt(match[1], 10) : undefined;
    return res.status(200).json({ row });
  } catch (err) {
    console.error('Erro ao registrar planilha:', err);
    return res.status(500).json({ error: 'Erro ao registrar planilha' });
  }
}
