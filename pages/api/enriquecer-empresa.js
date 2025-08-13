// pages/api/enriquecer-empresa.js
import { getSheetsClient, getSheetData } from '../../lib/googleSheets';
import { enrichCompanyData } from '../../lib/perplexity.js';

const SHEET_LAYOUT = 'layout_importacao_empresas';
const SHEET_LEADS = 'Leads Exact Spotter';
const SHEET_SHEET1 = 'Sheet1';
const SHEET_PADROES = 'Padroes';
const KEY = 'Cliente_ID';

// ---- Utils ---------------------------------------------------------------
const clean = (v) => (v ?? '').toString().trim();

const normalize = (v) =>
  clean(v)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function normalizeEmpty(v) {
  const s = clean(v).toLowerCase();
  if (!s) return '';
  const bad = new Set([
    'nao', 'não', 'n/d', 'nd', 'n/a', 'na', 'nao informado',
    'não informado', 'nao especificado', 'não especificado',
    '[não especificado]', 'nao encontrado', 'não encontrado',
  ]);
  return bad.has(s) ? '' : clean(v);
}

function normalizeUF(uf) {
  const norm = clean(uf)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z]/g, '');
  const map = {
    AC: 'AC', ACRE: 'AC',
    AL: 'AL', ALAGOAS: 'AL',
    AP: 'AP', AMAPA: 'AP',
    AM: 'AM', AMAZONAS: 'AM',
    BA: 'BA', BAHIA: 'BA',
    CE: 'CE', CEARA: 'CE', CEARÁ: 'CE',
    DF: 'DF', DISTRITOFEDERAL: 'DF',
    ES: 'ES', ESPIRITOSANTO: 'ES', ESPÍRITOSANTO: 'ES',
    GO: 'GO', GOIAS: 'GO', GOIÁS: 'GO',
    MA: 'MA', MARANHAO: 'MA', MARANHÃO: 'MA',
    MT: 'MT', MATOGROSSO: 'MT',
    MS: 'MS', MATOGROSSODOSUL: 'MS',
    MG: 'MG', MINASGERAIS: 'MG',
    PA: 'PA', PARA: 'PA', PARÁ: 'PA',
    PB: 'PB', PARAIBA: 'PB', PARAÍBA: 'PB',
    PR: 'PR', PARANA: 'PR', PARANÁ: 'PR',
    PE: 'PE', PERNAMBUCO: 'PE',
    PI: 'PI', PIAUI: 'PI', PIAUÍ: 'PI',
    RJ: 'RJ', RIODEJANEIRO: 'RJ',
    RN: 'RN', RIOGRANDEDONORTE: 'RN',
    RS: 'RS', RIOGRANDEDOSUL: 'RS',
    RO: 'RO', RONDONIA: 'RO', RONDÔNIA: 'RO',
    RR: 'RR', RORAIMA: 'RR',
    SC: 'SC', SANTACATARINA: 'SC',
    SP: 'SP', SAOPAULO: 'SP',
    SE: 'SE', SERGIPE: 'SE',
    TO: 'TO', TOCANTINS: 'TO'
  };
  return map[norm] || norm;
}

function splitPhones(str) {
  if (!str) return [];
  return [...new Set(str.split(';').map((s) => clean(s)).filter(Boolean))];
}

function joinPhones(arr) {
  return arr && arr.length ? arr.join(';') : '';
}

function preferNonEmpty(curr, next) {
  return clean(next) || clean(curr) || '';
}

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

const normalizeKey = (v) => String(v ?? '').trim();
const normalizeName = (v) =>
  normalizeKey(v)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

// cabeçalho canônico e aliases para layout_importacao_empresas
const CANON = [
  'Cliente_ID',
  'Nome da Empresa',
  'Site Empresa',
  'País Empresa',
  'Estado Empresa',
  'Cidade Empresa',
  'Logradouro Empresa',
  'Numero Empresa',
  'Bairro Empresa',
  'Complemento Empresa',
  'CEP Empresa',
  'CNPJ Empresa',
  'DDI Empresa',
  'Telefones Empresa',
  'Observação Empresa',
];

const ALIASES = {
  'pais empresa': 'País Empresa',
  'país empresa': 'País Empresa',
  'numero empresa': 'Numero Empresa',
  'número empresa': 'Numero Empresa',
  'observacao empresa': 'Observação Empresa',
};

function canonize(label) {
  const n = normalize(label);
  if (ALIASES[n]) return ALIASES[n];
  const hit = CANON.find((c) => normalize(c) === n);
  return hit || label;
}

// colunas necessárias no destino
const LEAD_COLS = new Set([
  KEY,
  'Nome do Lead', 'Origem', 'Sub-Origem', 'Mercado', 'Produto',
  'Site', 'País', 'Estado', 'Cidade', 'Logradouro', 'Número', 'Bairro', 'Complemento', 'CEP',
  'DDI', 'Telefones',
  'Observação', 'CPF/CNPJ',
  'Nome Contato', 'E-mail Contato', 'Cargo Contato', 'DDI Contato', 'Telefones Contato',
  'Tipo do Serv. Comunicação', 'ID do Serv. Comunicação', 'Área',
  'Nome da Empresa', 'Etapa', 'Funil',
]);

// domínios gratuitos ignorados
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'gmail.com.br', 'hotmail.com', 'hotmail.com.br',
  'outlook.com', 'outlook.com.br', 'live.com', 'yahoo.com',
  'yahoo.com.br', 'bol.com.br', 'uol.com.br', 'icloud.com',
  'msn.com', 'aol.com', 'terra.com.br',
]);

function extractDomain(email) {
  const match = String(email || '').toLowerCase().match(/@([^\s@]+)/);
  if (!match) return '';
  const domain = match[1];
  if (FREE_EMAIL_DOMAINS.has(domain)) return '';
  return domain;
}

function domainFromRow(r) {
  const emails = [
    r['Pessoa - Email - Work'],
    r['Pessoa - Email - Home'],
    r['Pessoa - Email - Other'],
  ];
  for (const e of emails) {
    const d = extractDomain(e);
    if (d) return d;
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { nome, estado, cidade, cep, overwrite } = req.body || {};
    if (!nome) {
      return res.status(400).json({ ok: false, error: 'Nome é obrigatório' });
    }

    // 1) enriquecimento externo
    const enrichedRaw = await enrichCompanyData({ nome, estado, cidade, cep });

    const enriched = {
      nome: normalizeEmpty(enrichedRaw.nome || nome),
      site: normalizeEmpty(enrichedRaw.site).replace(/\/+$/, ''),
      pais: normalizeEmpty(enrichedRaw.pais),
      estado: normalizeUF(normalizeEmpty(enrichedRaw.estado)),
      cidade: normalizeEmpty(enrichedRaw.cidade),
      logradouro: normalizeEmpty(enrichedRaw.logradouro),
      numero: normalizeEmpty(enrichedRaw.numero),
      bairro: normalizeEmpty(enrichedRaw.bairro),
      complemento: normalizeEmpty(enrichedRaw.complemento),
      cep: normalizeEmpty(enrichedRaw.cep),
      cnpj: normalizeEmpty(enrichedRaw.cnpj),
      ddi: normalizeEmpty(enrichedRaw.ddi),
      telefone: normalizeEmpty(enrichedRaw.telefone),
      telefone2: normalizeEmpty(enrichedRaw.telefone2),
      observacao: normalizeEmpty(enrichedRaw.observacao),
    };

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // leitura completa da Sheet1
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_SHEET1}!1:1`,
    });
    const sheet1Header = headerResp.data.values?.[0] || [];
    const endColSheet1 = colLetter(sheet1Header.length - 1);
    const valuesResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_SHEET1}!A2:${endColSheet1}`,
    });
    const sheet1Rows = (valuesResp.data.values || []).map((vals, idx) => {
      const obj = { _rowNumber: idx + 2 };
      sheet1Header.forEach((h, i) => {
        obj[h] = vals[i] ?? '';
      });
      return obj;
    });

    // índices por Cliente_ID e Organização - Nome
    const byId = new Map();
    const byName = new Map();
    for (const r of sheet1Rows) {
      const id = normalizeKey(r['Cliente_ID']);
      const org = normalizeName(
        r['Organização - Nome'] ||
          r['Organizacao - Nome'] ||
          r['Organização- Nome']
      );
      if (id) byId.set(id, r);
      if (org) byName.set(org, r);
    }

    const idFromPayload = normalizeKey(
      req.body?.Cliente_ID || req.body?.clienteId || req.body?.id
    );
    const idFromQuery = normalizeKey(
      req.query?.Cliente_ID || req.query?.clienteId || req.query?.id
    );
    const nameFromRequest = normalizeName(
      req.body?.nome ||
        req.body?.OrganizacaoNome ||
        req.body?.orgName ||
        req.query?.nome ||
        req.query?.OrganizacaoNome ||
        req.query?.orgName
    );

    let clienteId = idFromPayload || idFromQuery;
    let base = null,
      foundById = false,
      foundByName = false;
    if (clienteId && byId.has(clienteId)) {
      base = byId.get(clienteId);
      foundById = true;
    } else if (nameFromRequest && byName.has(nameFromRequest)) {
      base = byName.get(nameFromRequest);
      foundByName = true;
      clienteId = normalizeKey(base['Cliente_ID']);
    }

    const debug = req.query?.debug === '1';
    const headerSample = sheet1Header
      .map((h, i) => ({ index: i, header: h }))
      .slice(0, 20);

    if (!base) {
      if (debug) {
        return res.status(404).json({
          error: 'Cliente não encontrado na Sheet1',
          tried: { id: clienteId || idFromPayload || idFromQuery, name: nameFromRequest },
          sheet1Headers: headerSample,
          debug: true,
        });
      }
      return res
        .status(404)
        .json({ ok: false, error: 'Cliente não encontrado em Sheet1' });
    }

    if (debug) {
      return res.status(200).json({
        foundById,
        foundByName,
        keysTried: {
          idFromRequest: idFromQuery,
          idFromPayload,
          nameFromRequest,
        },
        sheet1Headers: headerSample,
        cliente: {
          Cliente_ID: base['Cliente_ID'],
          'Organização - Nome':
            base['Organização - Nome'] ||
            base['Organizacao - Nome'] ||
            base['Organização- Nome'],
          'Telefone Normalizado': base['Telefone Normalizado'] || '',
        },
      });
    }

    // ler demais abas
    const [padroesData, leadsData] = await Promise.all([
      getSheetData(SHEET_PADROES),
      getSheetData(SHEET_LEADS),
    ]);

    // leitura robusta da layout_importacao_empresas
    const layoutHeaderResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_LAYOUT}!1:1`,
    });
    const rawLayoutHeader = layoutHeaderResp.data.values?.[0] || [];
    let mappedLayoutHeader = rawLayoutHeader.map(canonize);
    const missingLayoutCols = CANON.filter((c) => !mappedLayoutHeader.includes(c));
    let fixedHeaders = false;
    if (missingLayoutCols.length) {
      fixedHeaders = true;
      mappedLayoutHeader = [...mappedLayoutHeader, ...missingLayoutCols];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_LAYOUT}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [mappedLayoutHeader] },
      });
    }
    const endColLayout = colLetter(mappedLayoutHeader.length - 1);
    let layoutBodyResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_LAYOUT}!A2:${endColLayout}`,
    });
    let layoutValues = layoutBodyResp.data.values || [];
    if (missingLayoutCols.length && layoutValues.length) {
      const patched = layoutValues.map((row) => [
        ...row,
        ...new Array(missingLayoutCols.length).fill(''),
      ]);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_LAYOUT}!A2:${endColLayout}`,
        valueInputOption: 'RAW',
        requestBody: { values: patched },
      });
      layoutValues = patched;
    }
    const layoutRows = layoutValues.map((vals, idx) => {
      const obj = { _rowNumber: idx + 2 };
      mappedLayoutHeader.forEach((h, i) => {
        obj[h] = vals[i] ?? '';
      });
      return obj;
    });

    // contagens de colunas opcionais vazias e índices por Cliente_ID
    const optionalCols = CANON.filter((c) => c !== 'Cliente_ID' && c !== 'Nome da Empresa');
    const missingOptional = {};
    let ignoradasSemId = 0,
      ignoradasSemNome = 0;
    const layoutMap = new Map();
    for (const r of layoutRows) {
      const id = clean(r['Cliente_ID']);
      const nomeEmp = clean(r['Nome da Empresa']);
      if (!id) {
        ignoradasSemId++;
        continue;
      }
      if (!nomeEmp) {
        ignoradasSemNome++;
        continue;
      }
      layoutMap.set(id, r);
      for (const c of optionalCols) {
        if (!clean(r[c])) {
          missingOptional[c] = (missingOptional[c] || 0) + 1;
        }
      }
    }

    // se site ausente, tenta derivar de e-mail
    if (!enriched.site) {
      const domain = domainFromRow(base);
      if (domain) enriched.site = `www.${domain}`;
    }

    const existingLayout = layoutMap.get(clean(clienteId));
    if (existingLayout && !overwrite) {
      return res.status(200).json({ ok: false, exists: true });
    }

    // 3) Preparar dados de Padroes
    const produtosValidos = padroesData.rows
      .map((r) => clean(r['Produtos']))
      .filter(Boolean);
    const mercadosValidos = padroesData.rows
      .map((r) => clean(r['Mercados']))
      .filter(Boolean);

    // 4) Upsert em Leads Exact Spotter
    let header = Array.isArray(leadsData.headers) ? [...leadsData.headers] : [];
    if (!header.includes(KEY)) header.unshift(KEY);
    for (const c of LEAD_COLS) {
      if (!header.includes(c)) header.push(c);
    }
    const endCol = colLetter(header.length - 1);

    const headerChanged =
      !leadsData.headers ||
      header.length !== leadsData.headers.length ||
      header.some((h, i) => h !== leadsData.headers[i]);
    if (headerChanged) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_LEADS}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [header] },
      });
    }

    const destRow = leadsData.rows.find(
      (r) => clean(r[KEY]) === clean(clienteId)
    );

    const produtoAtual = clean(destRow?.['Produto']);
    const produto = produtosValidos.includes(produtoAtual) ? produtoAtual : '';
    const nomeEmpresa = enriched.nome || clean(base['Nome da Empresa']);
    const nomeLead = produto ? `${nomeEmpresa} - ${produto}` : nomeEmpresa;

    const segmento = clean(base['Organização - Segmento']);
    const mercado =
      segmento && mercadosValidos.includes(segmento) ? segmento : 'N/A';

    const pais = enriched.pais ||
      ((enriched.cidade && enriched.estado) ? 'Brasil' : '');

    const telSheet1 = splitPhones(base['Telefone Normalizado']);
    const telLayout = splitPhones(
      joinPhones([enriched.telefone, enriched.telefone2])
    );
    const telefones = telSheet1.length ? telSheet1 : telLayout;
    const telefonesStr = joinPhones(telefones);
    const ddi = telefones.length ? enriched.ddi : '';

    const nomeContato = clean(base['Nome Contato']);
    const emailContato = clean(base['E-mail Contato']);
    const cargoContato = clean(base['Cargo Contato']);
    const telsContato = splitPhones(base['Telefones Contato']);
    const ddiContato = telsContato.length ? clean(base['DDI Contato']) : '';
    const algumContatoPreenchido = !!(
      nomeContato || emailContato || cargoContato || telsContato.length
    );
    const errosObrigatorios = [];
    if (algumContatoPreenchido && !nomeContato) {
      errosObrigatorios.push({ [KEY]: clienteId, erro: 'Nome Contato obrigatório quando houver outros campos de contato' });
    }

    const atual = destRow || {};
    const novoLead = {
      [KEY]: clienteId,
      'Nome do Lead': preferNonEmpty(atual['Nome do Lead'], nomeLead),
      'Origem': 'Carteira de Clientes',
      'Sub-Origem': '',
      'Mercado': preferNonEmpty(atual['Mercado'], mercado),
      'Produto': preferNonEmpty(atual['Produto'], produto),
      'Site': preferNonEmpty(atual['Site'], enriched.site),
      'País': preferNonEmpty(atual['País'], pais),
      'Estado': preferNonEmpty(atual['Estado'], enriched.estado),
      'Cidade': preferNonEmpty(atual['Cidade'], enriched.cidade),
      'Logradouro': preferNonEmpty(atual['Logradouro'], enriched.logradouro),
      'Número': preferNonEmpty(atual['Número'], enriched.numero),
      'Bairro': preferNonEmpty(atual['Bairro'], enriched.bairro),
      'Complemento': preferNonEmpty(atual['Complemento'], enriched.complemento),
      'CEP': preferNonEmpty(atual['CEP'], enriched.cep),
      'DDI': preferNonEmpty(atual['DDI'], ddi),
      'Telefones': preferNonEmpty(atual['Telefones'], telefonesStr),
      'Observação': enriched.observacao || clean(atual['Observação']),
      'CPF/CNPJ': preferNonEmpty(atual['CPF/CNPJ'], enriched.cnpj),
      'Nome Contato': preferNonEmpty(atual['Nome Contato'], nomeContato),
      'E-mail Contato': preferNonEmpty(atual['E-mail Contato'], emailContato),
      'Cargo Contato': preferNonEmpty(atual['Cargo Contato'], cargoContato),
      'DDI Contato': preferNonEmpty(atual['DDI Contato'], ddiContato),
      'Telefones Contato': preferNonEmpty(atual['Telefones Contato'], joinPhones(telsContato)),
      'Tipo do Serv. Comunicação': '',
      'ID do Serv. Comunicação': '',
      'Área': '',
      'Nome da Empresa': preferNonEmpty(atual['Nome da Empresa'], nomeEmpresa),
      'Etapa': 'Agendados',
      'Funil': 'Padrão',
    };

    const leadRowValues = header.map((col) => (novoLead[col] ?? '').toString());
    let leadAction;
    if (destRow && destRow._rowNumber) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_LEADS}!A${destRow._rowNumber}:${endCol}${destRow._rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [leadRowValues] },
      });
      leadAction = 'updated';
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_LEADS}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [leadRowValues] },
      });
      leadAction = 'created';
    }

    // 5) Atualizar layout_importacao_empresas
    const telefonesLayout = joinPhones(
      splitPhones(enriched.telefone).concat(splitPhones(enriched.telefone2))
    );
    const paisLayout = enriched.pais ||
      ((enriched.cidade && enriched.estado) ? 'Brasil' : '');
    const layoutObj = {
      Cliente_ID: clienteId,
      'Nome da Empresa': enriched.nome,
      'Site Empresa': enriched.site,
      'País Empresa': paisLayout,
      'Estado Empresa': enriched.estado,
      'Cidade Empresa': enriched.cidade,
      'Logradouro Empresa': enriched.logradouro,
      'Numero Empresa': enriched.numero,
      'Bairro Empresa': enriched.bairro,
      'Complemento Empresa': enriched.complemento,
      'CEP Empresa': enriched.cep,
      'CNPJ Empresa': enriched.cnpj,
      'DDI Empresa': enriched.ddi,
      'Telefones Empresa': telefonesLayout,
      'Observação Empresa': enriched.observacao,
    };
    const layoutRowValues = mappedLayoutHeader.map((h) => (layoutObj[h] ?? '').toString());

    let layoutAction;
    if (existingLayout && existingLayout._rowNumber) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_LAYOUT}!A${existingLayout._rowNumber}:${endColLayout}${existingLayout._rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [layoutRowValues] },
      });
      layoutAction = 'updated';
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_LAYOUT}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [layoutRowValues] },
      });
      layoutAction = 'created';
    }

    return res.status(200).json({
      ok: true,
      headerUsed: mappedLayoutHeader,
      addedColumns: missingLayoutCols,
      fixedHeaders,
      missingOptional,
      ignoradasSemId,
      ignoradasSemNome,
      data: { enriched, leadAction, layoutAction, errosObrigatorios },
    });
  } catch (error) {
    console.error('[enriquecer-empresa] fail', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}

