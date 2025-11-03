import { getSheetsClient, getSheetData, withRetry, chunk } from '../../lib/googleSheets';

const SHEET_LAYOUT = 'layout_importacao_empresas';
const SHEET_SHEET1 = 'sheet1';
const SHEET_PADROES = 'padroes';
const SHEET_DEST = 'sheet1';
const KEY = 'cliente_id'; // chave única padronizada

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
    const produtosValidos = padroes.map(r => clean(r['prudutos'])).filter(Boolean);
    const mercadosValidos = padroes.map(r => clean(r['mercados'])).filter(Boolean);

    // 3) Índices por Cliente_ID
    const idOf = (r) => clean(r[KEY]);
    const mapSheet1 = new Map(sheet1.map(r => [idOf(r), r]).filter(([k]) => !!k));
    const mapDest = new Map(destRows.map(r => [idOf(r), r]).filter(([k]) => !!k));

    // 4) Header do destino (migrar Client_ID -> Cliente_ID se necessário)
    const neededCols = new Set([
        KEY,
        'nome_do_lead', 'origem', 'sub_origem', 'mercado', 'produto',
        'site', 'pais', 'estado', 'cidade', 'logradouro', 'numero', 'bairro', 'complemento', 'cep',
        'ddi', 'telefones',
        'observacao', 'cpf_cnpj',
        'nome_contato', 'e_mail_contato', 'cargo_contato', 'ddi_contato', 'telefones_contato',
        'tipo_do_serv_comunicacao', 'id_do_serv_comunicacao', 'area',
        'nome_da_empresa', 'etapa', 'funil',
    ]);

    let header = Array.isArray(destHeadersRaw) ? [...destHeadersRaw] : [];
    const hasOld = header.includes('cliente_id');
    const hasKey = header.includes(KEY);
    if (hasOld && !hasKey) {
      header = header.map(h => (h === 'Client_ID' ? KEY : h));
    }
    if (!header.includes(KEY)) header.unshift(KEY);
    for (const c of neededCols) {
      if (!header.includes(c)) header.push(c);
    }

    const sheets = await getSheetsClient();
    const headerChanged = !destHeadersRaw
      || header.length !== destHeadersRaw.length
      || header.some((h, i) => h !== destHeadersRaw[i]);

    if (headerChanged) {
      await withRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: `${SHEET_DEST}!1:1`,
          valueInputOption: 'RAW',
          requestBody: { values: [header] },
        })
      );
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
      const nomeEmpresa = pick(row, 'nome_da_empresa') || clean(atual['nome_da_empresa']);

      // Produto (pode não existir na layout; só aceita se ∈ Padroes/Produtos)
      const produtoInput = pick(row, 'produto'); // se não existir, virá vazio
      const produto = produtosValidos.includes(produtoInput) ? produtoInput : clean(atual['produto']);

      // Nome do Lead
      const nomeLead = produto ? `${nomeEmpresa} - ${produto}` : `${nomeEmpresa}`;

      // Mercado (Sheet1 -> Organização - Segmento)
      const segmento = clean(base['organizacao_segmento']);
      const mercado = segmento && mercadosValidos.includes(segmento) ? segmento : 'N/A';

      // Site (remover barras finais)
      const rawSite = pick(row, 'site_empresa');
      const site = rawSite.replace(/\/+$/, '');

      // Endereço vindo da layout
      const estado = normalizeUF(pick(row, 'estado_empresa'));
      const cidade = pick(row, 'cidade_empresa');
      const logradouro = pick(row, 'logradouro_empresa');
      const numero = pick(row, 'numero_empresa');
      const bairro = pick(row, 'bairro_empresa');
      const complemento = pick(row, 'complemento_empresa');
      const cep = pick(row, 'cep_empresa');

      // País: preferir “País Empresa” (ou “Pais Empresa”); se faltar e houver cidade+estado, usar "Brasil"
      const pais = pick(row, 'pais_empresa') || ((cidade && estado) ? 'Brasil' : '');

      // Telefones (prioridade: Card -> layout -> Sheet1)
      const telsCard = splitPhones(pick(row, 'telefones_card')); // pode não existir
      const telsLayout = splitPhones(pick(row, 'telefones_empresa'));
      const telSheet1 = splitPhones(base['telefone_normalizado']);
      const telefones = telsCard.length ? telsCard : (telsLayout.length ? telsLayout : telSheet1);
      const telefonesStr = joinPhones(telefones);

      // DDI apenas se houver algum telefone
      const ddi = telefones.length ? pick(row, 'ddi_empresa', 'ddi') : '';

      // Observação (não herdar se vazio)
      const observacao = pick(row, 'observacao_empresa', 'observacao');

      // CPF/CNPJ
      const cnpj = pick(row, 'cnpj_empresa');

      // Contatos (Card) — podem não existir na layout
      const nomeContato = pick(row, 'nome_contato');
      const emailContato = pick(row, 'e_mail_contato', 'email_contato');
      const cargoContato = pick(row, 'cargo_contato');
      const telsContato = splitPhones(pick(row, 'telefones_contato'));
      const ddiContato = telsContato.length ? pick(row, 'ddi_contato') : '';
      const algumContatoPreenchido = !!(nomeContato || emailContato || cargoContato || telsContato.length);
      if (algumContatoPreenchido && !nomeContato) {
        errosObrigatorios.push({ [KEY]: id, erro: 'Nome Contato obrigatório quando houver outros campos de contato' });
      }

      // Monta objeto final com política "não sobrescrever com vazio"
      const novo = {
        [KEY]: id,

        'nome_do_lead': preferNonEmpty(atual['nome_do_lead'], nomeLead),
        'origem': 'Carteira de Clientes',
        'sub_origem': '',

        'mercado': preferNonEmpty(atual['mercado'], mercado),
        'produto': preferNonEmpty(atual['produto'], produto),

        'site': preferNonEmpty(atual['site'], site),

        'pais': preferNonEmpty(atual['pais'], pais),
        'estado': preferNonEmpty(atual['estado'], estado),
        'cidade': preferNonEmpty(atual['cidade'], cidade),
        'logradouro': preferNonEmpty(atual['logradouro'], logradouro),
        'numero': preferNonEmpty(atual['numero'], numero),
        'bairro': preferNonEmpty(atual['bairro'], bairro),
        'complemento': preferNonEmpty(atual['complemento'], complemento),
        'cep': preferNonEmpty(atual['cep'], cep),

        'ddi': preferNonEmpty(atual['ddi'], ddi),
        'telefones': preferNonEmpty(atual['telefones'], telefonesStr),

        'observacao': observacao || clean(atual['observacao']),

        'cpf_cnpj': preferNonEmpty(atual['cpf_cnpj'], cnpj),

        'nome_contato': preferNonEmpty(atual['nome_contato'], nomeContato),
        'e_mail_contato': preferNonEmpty(atual['e_mail_contato'], emailContato),
        'cargo_contato': preferNonEmpty(atual['cargo_contato'], cargoContato),
        'ddi_contato': preferNonEmpty(atual['ddi_contato'], ddiContato),
        'telefones_contato': preferNonEmpty(atual['telefones_contato'], joinPhones(telsContato)),

        'tipo_do_serv_comunicacao': '',
        'id_do_serv_comunicacao': '',
        'area': '',

        'nome_da_empresa': preferNonEmpty(atual['nome_da_empresa'], nomeEmpresa),
        'etapa': 'Agendados',
        'funil': 'Padrão',
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
      for (const batch of chunk(updates, 300)) {
        await withRetry(() =>
          sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            requestBody: {
              valueInputOption: 'RAW',
              data: batch,
            },
          })
        );
      }
    }
    if (appends.length > 0) {
      for (const batch of chunk(appends, 300)) {
        await withRetry(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: `${SHEET_DEST}!A1`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: batch },
          })
        );
      }
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

