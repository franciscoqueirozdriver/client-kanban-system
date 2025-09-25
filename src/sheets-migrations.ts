import { sheets_v4 } from 'googleapis';
import { getSheetsClient } from './sheets';

const LEGACY_PERDCOMP_HEADERS = [
  'Cliente_ID',
  'Nome da Empresa',
  'Perdcomp_ID',
  'CNPJ',
  'Tipo_Pedido',
  'Situacao',
  'Periodo_Inicio',
  'Periodo_Fim',
  'Quantidade_PERDCOMP',
  'Qtd_PERDCOMP_DCOMP',
  'Qtd_PERDCOMP_REST',
  'Qtd_PERDCOMP_RESSARC',
  'Qtd_PERDCOMP_CANCEL',
  'Numero_Processo',
  'Data_Protocolo',
  'Ultima_Atualizacao',
  'Quantidade_Receitas',
  'Quantidade_Origens',
  'Quantidade_DARFs',
  'URL_Comprovante_HTML',
  'URL_Comprovante_PDF',
  'Data_Consulta',
  'Tipo_Empresa',
  'Concorrentes',
  'Code',
  'Code_Message',
  'MappedCount',
  'Perdcomp_Principal_ID',
  'Perdcomp_Solicitante',
  'Perdcomp_Tipo_Documento',
  'Perdcomp_Tipo_Credito',
  'Perdcomp_Data_Transmissao',
  'Perdcomp_Situacao',
  'Perdcomp_Situacao_Detalhamento'
];

const PERDCOMP_REQUIRED_COLUMNS = [
  'Qtd_PERDCOMP_TOTAL',
  'Qtd_PERDCOMP_TOTAL_SEM_CANCEL',
  'Qtd_PERDCOMP_DCOMP',
  'Qtd_PERDCOMP_REST',
  'Qtd_PERDCOMP_RESSARC',
  'Qtd_PERDCOMP_CANCEL',
  'TOP3_CREDITOS',
  'SITUACOES_NORMALIZADAS',
  'Lista_PERDCOMP_CANCEL'
];

const PERDCOMP_ITENS_HEADERS = [
  'Cliente_ID',
  'Empresa_ID',
  'Nome da Empresa',
  'CNPJ',
  'Perdcomp_Numero',
  'Perdcomp_Formatado',
  'B1',
  'B2',
  'Data_DDMMAA',
  'Data_ISO',
  'Tipo_Codigo',
  'Tipo_Nome',
  'Natureza',
  'Familia',
  'Credito_Codigo',
  'Credito_Descricao',
  'Protocolo',
  'Situacao',
  'Situacao_Detalhamento',
  'Motivo_Normalizado',
  'Solicitante',
  'Fonte',
  'Data_Consulta'
];

const DIC_TIPOS_HEADERS = ['Tipo_Codigo', 'Tipo_Nome'] as const;
const DIC_NATUREZAS_HEADERS = ['Natureza', 'Familia', 'Descricao'] as const;
const DIC_CREDITOS_HEADERS = ['Credito_Codigo', 'Descricao'] as const;
const DIC_SITUACOES_HEADERS = ['Situacao_Original', 'Detalhe_Original', 'Motivo_Normalizado'] as const;

type HeaderArray = readonly string[];

type SheetHeaders = {
  PERDCOMP_ITENS: HeaderArray;
  DIC_TIPOS: HeaderArray;
  DIC_NATUREZAS: HeaderArray;
  DIC_CREDITOS: HeaderArray;
  DIC_SITUACOES: HeaderArray;
};

const HEADERS: SheetHeaders = {
  PERDCOMP_ITENS: PERDCOMP_ITENS_HEADERS,
  DIC_TIPOS: DIC_TIPOS_HEADERS,
  DIC_NATUREZAS: DIC_NATUREZAS_HEADERS,
  DIC_CREDITOS: DIC_CREDITOS_HEADERS,
  DIC_SITUACOES: DIC_SITUACOES_HEADERS
};

const DIC_TIPOS_SEED = [
  ['1', 'DCOMP'],
  ['2', 'REST'],
  ['8', 'CANC']
];

const DIC_NATUREZAS_SEED = [
  ['1.0', 'DCOMP', 'Declaração de Compensação'],
  ['1.1', 'RESSARC', 'Pedido de Ressarcimento'],
  ['1.2', 'REST', 'Pedido de Restituição'],
  ['1.3', 'DCOMP', 'Declaração de Compensação'],
  ['1.5', 'RESSARC', 'Pedido de Ressarcimento'],
  ['1.6', 'REST', 'Pedido de Restituição'],
  ['1.7', 'DCOMP', 'Declaração de Compensação'],
  ['1.8', 'CANC', 'Pedido de Cancelamento'],
  ['1.9', 'DCOMP', 'Cofins NC – Ressarc/Comp.']
];

const DIC_CREDITOS_SEED = [
  ['01', 'Ressarcimento de IPI'],
  ['02', 'Saldo Negativo de IRPJ'],
  ['03', 'Outros Créditos'],
  ['04', 'Pagamento indevido ou a maior'],
  ['15', 'Retenção – Lei nº 9.711/98'],
  ['16', 'Outros Créditos (Cancelamento)'],
  ['17', 'Reintegra'],
  ['18', 'Outros Crédititos'],
  ['19', 'Cofins Não-Cumulativa – Ressarc/Comp.'],
  ['24', 'Pagamento Indevido ou a Maior (eSocial)'],
  ['25', 'Outros Créditos'],
  ['57', 'Outros Créditos']
];

async function fetchSpreadsheet(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  return data;
}

async function ensureSheetExists({
  sheets,
  spreadsheetId,
  title,
  existing
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
  existing: Map<string, sheets_v4.Schema$Sheet>;
}): Promise<void> {
  if (existing.has(title)) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title }
          }
        }
      ]
    }
  });
}

async function getHeaderRow({
  sheets,
  spreadsheetId,
  title
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
}): Promise<string[]> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!1:1`
  });
  const values = (data.values?.[0] ?? []).map(cell => String(cell ?? '').trim());
  while (values.length && values[values.length - 1] === '') {
    values.pop();
  }
  return values;
}

async function updateHeaderRow({
  sheets,
  spreadsheetId,
  title,
  headers
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
  headers: string[];
}): Promise<void> {
  if (!headers.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!1:1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers]
    }
  });
}

async function ensurePerdcompHeader({
  sheets,
  spreadsheetId
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
}): Promise<void> {
  const current = await getHeaderRow({ sheets, spreadsheetId, title: 'PERDCOMP' });
  const next = [...current];
  let changed = false;

  for (const column of PERDCOMP_REQUIRED_COLUMNS) {
    if (!next.includes(column)) {
      next.push(column);
      changed = true;
    }
  }

  if (!current.length && !changed) {
    changed = true;
  }

  if (!current.length) {
    const combined = Array.from(
      new Set<string>([...LEGACY_PERDCOMP_HEADERS, ...PERDCOMP_REQUIRED_COLUMNS])
    );
    await updateHeaderRow({ sheets, spreadsheetId, title: 'PERDCOMP', headers: combined });
    return;
  }

  if (changed) {
    await updateHeaderRow({ sheets, spreadsheetId, title: 'PERDCOMP', headers: next });
  }
}

async function ensureExactHeader({
  sheets,
  spreadsheetId,
  title,
  headers
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: keyof SheetHeaders;
  headers: HeaderArray;
}): Promise<void> {
  const current = await getHeaderRow({ sheets, spreadsheetId, title });
  if (current.length === headers.length && current.every((value, idx) => value === headers[idx])) {
    return;
  }
  await updateHeaderRow({ sheets, spreadsheetId, title, headers: Array.from(headers) });
}

async function sheetHasData({
  sheets,
  spreadsheetId,
  title
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
}): Promise<boolean> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A2:A`
  });
  const rows = data.values ?? [];
  return rows.length > 0;
}

async function seedIfEmpty({
  sheets,
  spreadsheetId,
  title,
  rows
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
  rows: string[][];
}): Promise<void> {
  if (!rows.length) return;
  const hasData = await sheetHasData({ sheets, spreadsheetId, title });
  if (hasData) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: title,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows
    }
  });
}

export async function ensureSheetsAndHeaders({ spreadsheetId }: { spreadsheetId: string }): Promise<void> {
  if (!spreadsheetId) {
    throw new Error('spreadsheetId is required');
  }

  const sheets = await getSheetsClient();
  const spreadsheet = await fetchSpreadsheet(sheets, spreadsheetId);
  const existing = new Map<string, sheets_v4.Schema$Sheet>();
  for (const sheet of spreadsheet.sheets ?? []) {
    if (sheet.properties?.title) {
      existing.set(sheet.properties.title, sheet);
    }
  }

  const requiredSheets = ['PERDCOMP', 'PERDCOMP_ITENS', 'DIC_TIPOS', 'DIC_NATUREZAS', 'DIC_CREDITOS', 'DIC_SITUACOES'];

  for (const title of requiredSheets) {
    await ensureSheetExists({ sheets, spreadsheetId, title, existing });
    if (!existing.has(title)) {
      // refresh map after creation
      const refreshed = await fetchSpreadsheet(sheets, spreadsheetId);
      existing.clear();
      for (const sheet of refreshed.sheets ?? []) {
        if (sheet.properties?.title) {
          existing.set(sheet.properties.title, sheet);
        }
      }
    }
  }

  await ensurePerdcompHeader({ sheets, spreadsheetId });

  for (const [title, headers] of Object.entries(HEADERS) as Array<[keyof SheetHeaders, HeaderArray]>) {
    await ensureExactHeader({ sheets, spreadsheetId, title, headers });
  }

  await seedIfEmpty({ sheets, spreadsheetId, title: 'DIC_TIPOS', rows: DIC_TIPOS_SEED });
  await seedIfEmpty({ sheets, spreadsheetId, title: 'DIC_NATUREZAS', rows: DIC_NATUREZAS_SEED });
  await seedIfEmpty({ sheets, spreadsheetId, title: 'DIC_CREDITOS', rows: DIC_CREDITOS_SEED });
}

