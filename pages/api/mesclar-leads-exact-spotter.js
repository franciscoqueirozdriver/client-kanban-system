import { getSheetsClient, getSheetData } from '../../lib/googleSheets';

const SHEET_LAYOUT = 'layout_importacao_empresas';
const SHEET_SHEET1 = 'Sheet1';
const SHEET_PADROES = 'Padroes';
const SHEET_DEST = 'Leads Exact Spotter';
const KEY = 'Client_ID';

// Utils
const clean = (v) => (v ?? '').toString().trim();

function normalizeUF(uf) {
  const u = clean(uf).toUpperCase();
  const map = {
    AC: 'AC', AL: 'AL', AP: 'AP', AM: 'AM', BA: 'BA', CE: 'CE', DF: 'DF', ES: 'ES',
    GO: 'GO', MA: 'MA', MT: 'MT', MS: 'MS', MG: 'MG', PA: 'PA', PB: 'PB', PR: 'PR',
    PE: 'PE', PI: 'PI', RJ: 'RJ', RN: 'RN', RS: 'RS', RO: 'RO', RR: 'RR', SC: 'SC',
    SP: 'SP', SE: 'SE', TO: 'TO'
  };
  return map[u] || u;
}

function splitPhones(str) {
  if (!str) return [];
  return [...new Set(
    str.split(';').map(s => clean(s)).filter(Boolean)
  )];
}

function joinPhones(arr) {
  return (arr && arr.length) ? arr.join(';') : '';
}

function preferNonEmpty(curr, next) {
  return clean(next) || clean(curr) || '';
}

// Converte índice numérico (0-based) em letra de coluna (A, B, ... Z, AA...)
function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Ler todas as abas necessárias
    const [{ rows: layout }, { rows: sheet1 }, { rows: padroes }, destRaw] = await Promise.all([
      getSheetData(SHEET_LAYOUT),
      getSheetData(SHEET_SHEET1),
      getSheetData(SHEET_PADROES),
      getSheetData(SHEET_DEST),
    ]);

    const { headers: destHeadersRaw, rows: destRows } = destRaw;

    // 2) Montar listas válidas de Produtos e Mercados
    const produtosValidos = padroes.map(r => clean(r['Produtos'])).filter(Boolean);
    const mercadosValidos = padroes.map(r => clean(r['Mercados'])).filter(Boolean);

    // 3) Índices rápidos por Client_ID
    const mapSheet1 = new Map(sheet1.filter(r => clean(r[KEY])).map(r => [clean(r[KEY]), r]));
    const mapDest = new Map(destRows.filter(r => clean(r[KEY])).map(r => [clean(r[KEY]), r]));

    // 4) Conjunto de colunas obrigatórias do destino
    const neededCols = new Set([
      KEY,
      'Nome do Lead', 'Origem', 'Sub-Origem', 'Mercado', 'Produto',
      'Site', 'Estado', 'Cidade', 'Logradouro', 'Número', 'Bairro', 'Complemento', 'CEP',
      'DDI', 'Telefones',
      'Observação', 'CPF/CNPJ',
      'Nome Contato', 'E-mail Contato', 'Cargo Contato', 'DDI Contato', 'Telefones Contato',
      'Tipo do Serv. Comunicação', 'ID do Serv. Comunicação', 'Área',
      'Nome da Empresa', 'Etapa', 'Funil',
    ]);

    // 5) Garantir header do destino (unir header atual com neededCols)
    let header = Array.isArray(destHeadersRaw) ? [...destHeadersRaw] : [];
    for (const c of neededCols) {
      if (!header.includes(c)) header.push(c);
    }
    const sheets = await getSheetsClient();
    if (!destHeadersRaw || header.length !== destHeadersRaw.length || header.some((h, i) => h !== destHeadersRaw[i])) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${SHEET_DEST}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [header] },
      });
    }

    const endCol = colLetter(header.length - 1);

    // 6) Preparar upserts
    const updates = []; // { range, values }
    const appends = []; // [ ...values ]
    let created = 0, updated = 0, ignored = 0;
    const errosObrigatorios = [];

    for (const row of layout) {
      const clientId = clean(row[KEY]);
      if (!clientId) { ignored++; continue; }

      const base = mapSheet1.get(clientId);
      if (!base) { ignored++; continue; }

      const atual = mapDest.get(clientId) || {};

      const nomeEmpresa = clean(row['Nome da Empresa']) || clean(atual['Nome da Empresa']);

      const produtoInput = clean(row['Produto']);
      const produto = produtosValidos.includes(produtoInput) ? produtoInput : clean(atual['Produto']);

      const nomeLead = produto ? `${nomeEmpresa} - ${produto}` : `${nomeEmpresa}`;

      const segmento = clean(base['Organização - Segmento']);
      const mercado = segmento && mercadosValidos.includes(segmento) ? segmento : 'N/A';

      const rawSite = clean(row['Site Empresa']);
      const site = rawSite.replace(/\/+$/, '');

      const camposEndereco = {
        Estado: row['Estado Empresa'] ? normalizeUF(row['Estado Empresa']) : '',
        Cidade: clean(row['Cidade Empresa']),
        Logradouro: clean(row['Logradouro Empresa']),
        Número: clean(row['Numero Empresa']),
        Bairro: clean(row['Bairro Empresa']),
        Complemento: clean(row['Complemento Empresa']),
        CEP: clean(row['CEP Empresa']),
      };

      const telsCard = splitPhones(row['Telefones Card']);
      const telsLayout = splitPhones(row['Telefones Empresa']);
      const telSheet1 = splitPhones(base['Telefone Normalizado']);
      const telefones = telsCard.length ? telsCard : (telsLayout.length ? telsLayout : telSheet1);
      const telefonesStr = joinPhones(telefones);
      const ddi = telefones.length ? clean(row['DDI'] || row['DDI Empresa']) : '';

      const observacao = clean(row['Observação'] ?? row['Observação Empresa']);

      const cnpj = clean(row['CNPJ Empresa']);

      const nomeContato = clean(row['Nome Contato']);
      const emailContato = clean(row['E-mail Contato']);
      const cargoContato = clean(row['Cargo Contato']);
      const telsContato = splitPhones(row['Telefones Contato']);
      const ddiContato = telsContato.length ? clean(row['DDI Contato'] || row['DDI Contato Empresa']) : '';
      const algumContatoPreenchido = !!(nomeContato || emailContato || cargoContato || telsContato.length);
      if (algumContatoPreenchido && !nomeContato) {
        errosObrigatorios.push({ Client_ID: clientId, erro: 'Nome Contato obrigatório quando houver outros campos de contato' });
      }

      const novo = {
        [KEY]: clientId,

        'Nome do Lead': preferNonEmpty(atual['Nome do Lead'], nomeLead),
        'Origem': 'Carteira de Clientes',
        'Sub-Origem': '',

        'Mercado': preferNonEmpty(atual['Mercado'], mercado),
        'Produto': preferNonEmpty(atual['Produto'], produto),

        'Site': preferNonEmpty(atual['Site'], site),

        'Estado': preferNonEmpty(atual['Estado'], camposEndereco.Estado),
        'Cidade': preferNonEmpty(atual['Cidade'], camposEndereco.Cidade),
        'Logradouro': preferNonEmpty(atual['Logradouro'], camposEndereco.Logradouro),
        'Número': preferNonEmpty(atual['Número'], camposEndereco.Número),
        'Bairro': preferNonEmpty(atual['Bairro'], camposEndereco.Bairro),
        'Complemento': preferNonEmpty(atual['Complemento'], camposEndereco.Complemento),
        'CEP': preferNonEmpty(atual['CEP'], camposEndereco.CEP),

        'DDI': preferNonEmpty(atual['DDI'], ddi),
        'Telefones': preferNonEmpty(atual['Telefones'], telefonesStr),

        'Observação': observacao || clean(atual['Observação']),

        'CPF/CNPJ': preferNonEmpty(atual['CPF/CNPJ'], cnpj),

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

      const rowValues = header.map(col => (novo[col] ?? '').toString());

      const exists = mapDest.get(clientId);
      if (exists && exists._rowNumber) {
        const rowIndex = exists._rowNumber;
        updates.push({
          range: `${SHEET_DEST}!A${rowIndex}:${endCol}${rowIndex}`,
          values: [rowValues],
        });
        updated++;
      } else {
        appends.push(rowValues);
        created++;
      }
    }

    // 7) Executar updates / appends
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    if (appends.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${SHEET_DEST}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appends },
      });
    }

    return res.status(200).json({
      criadas: created,
      atualizadas: updated,
      ignoradas: ignored,
      errosObrigatorios,
    });

  } catch (err) {
    console.error('[mesclar-leads-exact-spotter] ERRO:', err);
    return res.status(500).json({ error: err.message });
  }
}

