import { getSheetsClient, getSheetData } from '../../lib/googleSheets';

const SHEET_LAYOUT = 'layout_importacao_empresas';
const SHEET_SHEET1 = 'Sheet1';
const SHEET_PADROES = 'Padroes';
const SHEET_DEST = 'Leads Exact Spotter';
const DEST_KEY = 'Cliente_ID'; // chave única padronizada

// Utils
const clean = (v) => (v ?? '').toString().trim();
const pick = (row, ...names) => {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && clean(v)) return clean(v);
  }
  return '';
};

function normalizeUF(uf) {
  const u = clean(uf).toUpperCase();
  const map = { AC:'AC', AL:'AL', AP:'AP', AM:'AM', BA:'BA', CE:'CE', DF:'DF', ES:'ES',
    GO:'GO', MA:'MA', MT:'MT', MS:'MS', MG:'MG', PA:'PA', PB:'PB', PR:'PR',
    PE:'PE', PI:'PI', RJ:'RJ', RN:'RN', RS:'RS', RO:'RO', RR:'RR', SC:'SC',
    SP:'SP', SE:'SE', TO:'TO' };
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
// A -> Z -> AA...
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
    // 1) Ler abas com helpers do lib
    const [{ rows: layout }, { rows: sheet1 }, { rows: padroes }, destRaw] = await Promise.all([
      getSheetData(SHEET_LAYOUT),
      getSheetData(SHEET_SHEET1),
      getSheetData(SHEET_PADROES),
      getSheetData(SHEET_DEST),
    ]);

    const { headers: destHeadersRaw, rows: destRows } = destRaw;

    // 2) Listas válidas de Produtos e Mercados
    const produtosValidos = padroes.map(r => clean(r['Produtos'])).filter(Boolean);
    const mercadosValidos = padroes.map(r => clean(r['Mercados'])).filter(Boolean);

    // 3) Índices por Cliente_ID
    const idOf = (r) => clean(r[DEST_KEY]);
    const mapSheet1 = new Map(sheet1.map(r => [idOf(r), r]).filter(([k]) => !!k));
    const mapDest = new Map(destRows.map(r => [idOf(r), r]).filter(([k]) => !!k));

    // 4) Header do destino (migrar Client_ID -> Cliente_ID se necessário)
    const neededCols = new Set([
      DEST_KEY,
      'Nome do Lead','Origem','Sub-Origem','Mercado','Produto',
      'Site','País','Estado','Cidade','Logradouro','Número','Bairro','Complemento','CEP',
      'DDI','Telefones',
      'Observação','CPF/CNPJ',
      'Nome Contato','E-mail Contato','Cargo Contato','DDI Contato','Telefones Contato',
      'Tipo do Serv. Comunicação','ID do Serv. Comunicação','Área',
      'Nome da Empresa','Etapa','Funil',
    ]);

    let header = Array.isArray(destHeadersRaw) ? [...destHeadersRaw] : [];
    const hasOld = header.includes('Client_ID');
    const hasNew = header.includes(DEST_KEY);
    if (hasOld && !hasNew) {
      header = header.map(h => (h === 'Client_ID' ? DEST_KEY : h));
    }
    if (!header.includes(DEST_KEY)) header.unshift(DEST_KEY);
    for (const c of neededCols) {
      if (!header.includes(c)) header.push(c);
    }

    const sheets = await getSheetsClient();
    const headerChanged = !destHeadersRaw
      || header.length !== destHeadersRaw.length
      || header.some((h, i) => h !== destHeadersRaw[i]);

    if (headerChanged) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${SHEET_DEST}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [header] },
      });
    }
    const endCol = colLetter(header.length - 1);

    // 5) Preparar upserts
    const updates = [];
    const appends = [];
    let created = 0, updated = 0, ignoradasSemId = 0, ignoradasSemBase = 0;
    const errosObrigatorios = [];

    for (const row of layout) {
      const id = idOf(row);
      if (!id) { ignoradasSemId++; continue; }

      const base = mapSheet1.get(id);
      if (!base) { ignoradasSemBase++; continue; }

      const atual = mapDest.get(id) || {};

      // Nome da Empresa
      const nomeEmpresa = pick(row, 'Nome da Empresa') || clean(atual['Nome da Empresa']);

      // Produto (pode não existir na layout; só aceita se ∈ Padroes/Produtos)
      const produtoInput = pick(row, 'Produto'); // se não existir, virá vazio
      const produto = produtosValidos.includes(produtoInput) ? produtoInput : clean(atual['Produto']);

      // Nome do Lead
      const nomeLead = produto ? `${nomeEmpresa} - ${produto}` : `${nomeEmpresa}`;

      // Mercado (Sheet1 -> Organização - Segmento)
      const segmento = clean(base['Organização - Segmento']);
      const mercado = segmento && mercadosValidos.includes(segmento) ? segmento : 'N/A';

      // Site (remover barras finais)
      const rawSite = pick(row, 'Site Empresa');
      const site = rawSite.replace(/\/+$/, '');

      // Endereço vindo da layout
      const estado = normalizeUF(pick(row, 'Estado Empresa'));
      const cidade = pick(row, 'Cidade Empresa');
      const logradouro = pick(row, 'Logradouro Empresa');
      const numero = pick(row, 'Numero Empresa', 'Número Empresa');
      const bairro = pick(row, 'Bairro Empresa');
      const complemento = pick(row, 'Complemento Empresa');
      const cep = pick(row, 'CEP Empresa');

      // País: preferir “País Empresa” (ou “Pais Empresa”); se faltar e houver cidade+estado, usar "Brasil"
      const pais = pick(row, 'País Empresa', 'Pais Empresa') || ((cidade && estado) ? 'Brasil' : '');

      // Telefones (prioridade: Card -> layout -> Sheet1)
      const telsCard = splitPhones(pick(row, 'Telefones Card')); // pode não existir
      const telsLayout = splitPhones(pick(row, 'Telefones Empresa'));
      const telSheet1 = splitPhones(base['Telefone Normalizado']);
      const telefones = telsCard.length ? telsCard : (telsLayout.length ? telsLayout : telSheet1);
      const telefonesStr = joinPhones(telefones);

      // DDI apenas se houver algum telefone
      const ddi = telefones.length ? pick(row, 'DDI Empresa', 'DDI') : '';

      // Observação (não herdar se vazio)
      const observacao = pick(row, 'Observação Empresa', 'Observação');

      // CPF/CNPJ
      const cnpj = pick(row, 'CNPJ Empresa');

      // Contatos (Card) — podem não existir na layout
      const nomeContato = pick(row, 'Nome Contato');
      const emailContato = pick(row, 'E-mail Contato', 'Email Contato');
      const cargoContato = pick(row, 'Cargo Contato');
      const telsContato = splitPhones(pick(row, 'Telefones Contato'));
      const ddiContato = telsContato.length ? pick(row, 'DDI Contato') : '';
      const algumContatoPreenchido = !!(nomeContato || emailContato || cargoContato || telsContato.length);
      if (algumContatoPreenchido && !nomeContato) {
        errosObrigatorios.push({ Cliente_ID: id, erro: 'Nome Contato obrigatório quando houver outros campos de contato' });
      }

      // Monta objeto final com política "não sobrescrever com vazio"
      const novo = {
        [DEST_KEY]: id,

        'Nome do Lead': preferNonEmpty(atual['Nome do Lead'], nomeLead),
        'Origem': 'Carteira de Clientes',
        'Sub-Origem': '',

        'Mercado': preferNonEmpty(atual['Mercado'], mercado),
        'Produto': preferNonEmpty(atual['Produto'], produto),

        'Site': preferNonEmpty(atual['Site'], site),

        'País': preferNonEmpty(atual['País'], pais),
        'Estado': preferNonEmpty(atual['Estado'], estado),
        'Cidade': preferNonEmpty(atual['Cidade'], cidade),
        'Logradouro': preferNonEmpty(atual['Logradouro'], logradouro),
        'Número': preferNonEmpty(atual['Número'], numero),
        'Bairro': preferNonEmpty(atual['Bairro'], bairro),
        'Complemento': preferNonEmpty(atual['Complemento'], complemento),
        'CEP': preferNonEmpty(atual['CEP'], cep),

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

      const exists = mapDest.get(id);
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

    // 6) Writes
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

    // 7) Retorno
    const ignoradas = ignoradasSemId + ignoradasSemBase; // total ignoradas
    return res.status(200).json({
      criadas: created,
      atualizadas: updated,
      ignoradas,
      ignoradasSemId,
      ignoradasSemBase,
      errosObrigatorios,
    });

  } catch (err) {
    console.error('[mesclar-leads-exact-spotter] ERRO:', err);
    return res.status(500).json({ error: err.message });
  }
}

