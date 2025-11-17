import { NextApiRequest, NextApiResponse } from 'next';
import { getSheetsClient, readSheet, withRetry, chunk } from '@/lib/googleSheets';
import { SHEETS, LEADS_EXACT_SPOTTER_COLUMNS, SHEET1_COLUMNS, LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS } from '@/lib/sheets-mapping';
import { Sheet1Row, LeadsExactSpotterRow, LayoutImportacaoEmpresasRow } from '@/types/sheets';

const KEY = 'cliente_id'; // chave única padronizada

// Utils
const clean = (v: any) => (v ?? '').toString().trim();
const pick = (row: any, ...names: string[]) => {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && clean(v)) return clean(v);
  }
  return '';
};

function normalizeUF(uf: any) {
  const norm = clean(uf)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z]/g, '');
  const map: Record<string, string> = {
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
function splitPhones(str: any) {
  if (!str) return [];
  return Array.from(new Set(
    str.split(';').map((s: any) => clean(s)).filter(Boolean)
  ));
}
function joinPhones(arr: any) {
  return (arr && arr.length) ? arr.join(';') : '';
}
function preferNonEmpty(curr: any, next: any) {
  return clean(next) || clean(curr) || '';
}
// A -> Z -> AA...
function colLetter(n: number) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Ler abas com helpers do lib
    const [layout, sheet1, padroes, destRows] = await Promise.all([
      readSheet<LayoutImportacaoEmpresasRow>(SHEETS.LAYOUT_IMPORTACAO_EMPRESAS),
      readSheet<Sheet1Row>(SHEETS.SHEET1),
      readSheet(SHEETS.PADROES), // Assuming no specific type for Padroes
      readSheet<LeadsExactSpotterRow>(SHEETS.LEADS_EXACT_SPOTTER),
    ]);
    const destHeadersRaw = Object.keys(LEADS_EXACT_SPOTTER_COLUMNS);

    // 2) Listas válidas de Produtos e Mercados
    const produtosValidos = padroes.map(r => clean(r['produtos'])).filter(Boolean);
    const mercadosValidos = padroes.map(r => clean(r['mercados'])).filter(Boolean);

    // 3) Índices por Cliente_ID
    const idOf = (r: { [key: string]: any }) => clean(r[KEY]);
    const mapSheet1 = new Map(sheet1.map((r): [string, Sheet1Row] => [idOf(r), r]).filter(([k]) => !!k));
    const mapDest = new Map(destRows.map((r): [string, LeadsExactSpotterRow] => [idOf(r), r]).filter(([k]) => !!k));

    // 4) Header do destino
    const header = Object.keys(LEADS_EXACT_SPOTTER_COLUMNS);
    const sheets = await getSheetsClient();
    const endCol = colLetter(header.length - 1);

    // 5) Preparar upserts
    const updates: { range: string, values: any[][] }[] = [];
    const appends: any[][] = [];
    let created = 0, updated = 0, ignoradasSemId = 0, ignoradasSemBase = 0;
    const errosObrigatorios: { [key: string]: any }[] = [];

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
      const ddi = telefones.length ? pick(row, 'ddi_empresa') : '';

      // Observação (não herdar se vazio)
      const observacao = pick(row, 'observacao_empresa');

      // CPF/CNPJ
      const cnpj = pick(row, 'cnpj_empresa');

      // Contatos (Card) — podem não existir na layout
      const nomeContato = pick(row, 'nome_contato');
      const emailContato = pick(row, 'email_contato');
      const cargoContato = pick(row, 'cargo_contato');
      const telsContato = splitPhones(pick(row, 'telefones_contato'));
      const ddiContato = telsContato.length ? pick(row, 'ddi_contato') : '';
      const algumContatoPreenchido = !!(nomeContato || emailContato || cargoContato || telsContato.length);
      if (algumContatoPreenchido && !nomeContato) {
        errosObrigatorios.push({ [KEY]: id, erro: 'Nome Contato obrigatório quando houver outros campos de contato' });
      }

      // Monta objeto final com política "não sobrescrever com vazio"
      const novo: Partial<LeadsExactSpotterRow> = {
        cliente_id: id,
        nome_do_lead: preferNonEmpty(atual['nome_do_lead'], nomeLead),
        origem: 'Carteira de Clientes',
        sub_origem: '',
        mercado: preferNonEmpty(atual['mercado'], mercado),
        produto: preferNonEmpty(atual['produto'], produto),
        site: preferNonEmpty(atual['site'], site),
        pais: preferNonEmpty(atual['pais'], pais),
        estado: preferNonEmpty(atual['estado'], estado),
        cidade: preferNonEmpty(atual['cidade'], cidade),
        logradouro: preferNonEmpty(atual['logradouro'], logradouro),
        numero: preferNonEmpty(atual['numero'], numero),
        bairro: preferNonEmpty(atual['bairro'], bairro),
        complemento: preferNonEmpty(atual['complemento'], complemento),
        cep: preferNonEmpty(atual['cep'], cep),
        ddi: preferNonEmpty(atual['ddi'], ddi),
        telefones: preferNonEmpty(atual['telefones'], telefonesStr),
        observacao: observacao || clean(atual['observacao']),
        cpf_cnpj: preferNonEmpty(atual['cpf_cnpj'], cnpj),
        nome_contato: preferNonEmpty(atual['nome_contato'], nomeContato),
        email_contato: preferNonEmpty(atual['email_contato'], emailContato),
        cargo_contato: preferNonEmpty(atual['cargo_contato'], cargoContato),
        ddi_contato: preferNonEmpty(atual['ddi_contato'], ddiContato),
        telefones_contato: preferNonEmpty(atual['telefones_contato'], joinPhones(telsContato)),
        tipo_do_serv_comunicacao: '',
        id_do_serv_comunicacao: '',
        area: '',
        nome_da_empresa: preferNonEmpty(atual['nome_da_empresa'], nomeEmpresa),
        etapa: 'Agendados',
        funil: 'Padrão',
      };

      const rowValues = header.map(col => (novo[col as keyof LeadsExactSpotterRow] ?? '').toString());

      const exists = mapDest.get(id);
      if (exists && exists._rowNumber) {
        const rowIndex = exists._rowNumber;
        updates.push({
          range: `${SHEETS.LEADS_EXACT_SPOTTER}!A${rowIndex}:${endCol}${rowIndex}`,
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
            range: `${SHEETS.LEADS_EXACT_SPOTTER}!A1`,
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
    return res.status(500).json({ error: (err as Error).message });
  }
}
