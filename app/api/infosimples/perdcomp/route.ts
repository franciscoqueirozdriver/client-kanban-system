import { NextResponse } from 'next/server';
import { sheets_v4 } from 'googleapis';
import { getSheetsClient } from '@/src/sheets';
import { ensureSheetsAndHeaders } from '@/src/sheets-migrations';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import {
  agregaPerdcomp,
  parsePerdcompNumero,
  normalizaMotivo,
  toPerdcompResumo,
  type Agregado,
  type PerdcompResumo,
  type PerdcompFamilia,
  type MotivoNormalizado
} from '@/utils/perdcomp';

export const runtime = 'nodejs';

const API_ENDPOINT = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

function columnNumberToLetter(columnNumber: number) {
  let temp = columnNumber;
  let letter = '';
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addYears(dateISO: string, years: number) {
  const date = new Date(dateISO);
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(base: number) {
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delays = [1500, 3000, 5000]): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status ?? error?.status ?? 0;
      const shouldRetry = status >= 500 || status === 0;
      if (!shouldRetry || i === attempts - 1) {
        throw error;
      }
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastError;
}

const FAMILIA_TO_TIPO_NOME: Record<PerdcompFamilia, string> = {
  DCOMP: 'DCOMP',
  REST: 'REST',
  RESSARC: 'RESSARC',
  CANC: 'CANC',
  DESCONHECIDO: 'Desconhecido'
};

const MOTIVOS_ORDER: MotivoNormalizado[] = [
  'Recepcionado',
  'Deferido',
  'Indeferido',
  'Cancelado',
  'Cancelamento negado',
  'Homologado',
  'Outro/Desconhecido'
];

let migrationsPromise: Promise<void> | null = null;

async function ensureMigration(spreadsheetId: string) {
  if (!migrationsPromise) {
    migrationsPromise = ensureSheetsAndHeaders({ spreadsheetId });
  }
  return migrationsPromise;
}

type InfosimplesItem = {
  perdcomp?: string;
  solicitante?: string;
  situacao?: string;
  situacao_detalhamento?: string;
  tipo_credito?: string;
  tipo_documento?: string;
  data_transmissao?: string;
  [key: string]: any;
};

type InfosimplesResponse = {
  code?: number;
  code_message?: string;
  mapped_count?: number;
  header?: { requested_at?: string };
  site_receipts?: string[];
  data?: Array<{ perdcomp?: InfosimplesItem[] }>;
};

async function fetchInfosimples({
  cnpj,
  data_inicio,
  data_fim,
  token
}: {
  cnpj: string;
  data_inicio: string;
  data_fim: string;
  token: string;
}): Promise<InfosimplesResponse> {
  const params = new URLSearchParams({
    token,
    cnpj,
    data_inicio,
    data_fim,
    timeout: '600'
  });

  const doCall = async () => {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const text = await response.text();
    let json: InfosimplesResponse | null = null;
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = null;
    }

    if (!response.ok || (json && typeof json.code === 'number' && ![200, 612].includes(json.code))) {
      const err: any = new Error('provider_error');
      err.status = response.status || 502;
      err.statusText = response.statusText || 'Bad Gateway';
      err.providerCode = json?.code;
      err.providerMessage = json?.code_message || json?.message || json?.errors?.[0]?.message || null;
      throw err;
    }

    return json ?? {};
  };

  return withRetry(doCall, 3, [1500, 3000, 5000]);
}

async function loadCreditDictionary(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<Record<string, string>> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'DIC_CREDITOS!A2:B'
  });
  const dict: Record<string, string> = {};
  for (const row of data.values ?? []) {
    const codigo = String(row?.[0] ?? '').padStart(2, '0');
    if (!codigo.trim()) continue;
    const descricao = String(row?.[1] ?? '').trim();
    dict[codigo] = descricao;
  }
  return dict;
}

async function appendMissingCredits({
  sheets,
  spreadsheetId,
  creditosDict,
  codigos
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  creditosDict: Record<string, string>;
  codigos: Set<string>;
}) {
  const missing = Array.from(codigos).filter(codigo => !creditosDict[codigo]);
  if (!missing.length) {
    return;
  }
  const values = missing.map(codigo => [codigo, '(pendente de descrição)']);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'DIC_CREDITOS',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values
    }
  });
  for (const codigo of missing) {
    creditosDict[codigo] = '(pendente de descrição)';
  }
}

function inferFonte(item: InfosimplesItem): string {
  const hasDetails = Boolean(
    item?.situacao ||
      item?.situacao_detalhamento ||
      item?.solicitante ||
      item?.tipo_credito ||
      item?.tipo_documento ||
      item?.data_transmissao
  );
  return hasDetails ? 'consulta_individual' : 'listagem';
}

function buildTopCreditosString(agregado: Agregado) {
  if (!agregado.topCreditos.length) {
    return '';
  }
  return agregado.topCreditos
    .map(item => `${item.codigo}:${item.quantidade}`)
    .join(' | ');
}

function buildSituacoesString(agregado: Agregado) {
  const parts: string[] = [];
  for (const motivo of MOTIVOS_ORDER) {
    const quantidade = agregado.porMotivo[motivo] ?? 0;
    if (!quantidade) continue;
    parts.push(`${motivo}:${quantidade}`);
  }
  return parts.join(' | ');
}

async function loadPerdcompRows({
  sheets,
  spreadsheetId
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
}) {
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PERDCOMP!1:1'
  });
  const headers = (headerResp.data.values?.[0] ?? []).map(value => String(value ?? ''));
  const dataResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PERDCOMP!A2:ZZ'
  });
  const rows = dataResp.data.values ?? [];
  return { headers, rows };
}

async function loadExistingItemKeys({
  sheets,
  spreadsheetId
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
}) {
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PERDCOMP_ITENS!1:1'
  });
  const headers = (headerResp.data.values?.[0] ?? []).map(value => String(value ?? ''));
  const cnpjIndex = headers.indexOf('CNPJ');
  const numeroIndex = headers.indexOf('Perdcomp_Numero');
  const dataResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PERDCOMP_ITENS!A2:W'
  });
  const values = dataResp.data.values ?? [];
  const set = new Set<string>();
  for (const row of values) {
    const cnpjRaw = String(row?.[cnpjIndex] ?? '').replace(/\D/g, '');
    const numero = String(row?.[numeroIndex] ?? '').trim();
    if (!cnpjRaw || !numero) continue;
    set.add(`${cnpjRaw}|${numero}`);
  }
  return { headers, keys: set };
}

function buildPerdcompItemRow({
  item,
  parsed,
  clienteId,
  empresaId,
  nomeEmpresa,
  cnpj,
  creditosDict,
  dataConsulta
}: {
  item: InfosimplesItem;
  parsed: ReturnType<typeof parsePerdcompNumero>;
  clienteId: string;
  empresaId?: string | null;
  nomeEmpresa: string;
  cnpj: string;
  creditosDict: Record<string, string>;
  dataConsulta: string;
}) {
  const creditoCodigo = parsed.credito ? parsed.credito.padStart(2, '0') : '';
  const creditoDescricao = creditoCodigo ? creditosDict[creditoCodigo] ?? '(desconhecido)' : '';
  const motivo = normalizaMotivo(item?.situacao, item?.situacao_detalhamento);
  const tipoNome = parsed.familia ? FAMILIA_TO_TIPO_NOME[parsed.familia] ?? 'Desconhecido' : 'Desconhecido';

  const base: Record<string, string> = {
    Cliente_ID: clienteId,
    'Empresa_ID': empresaId ?? clienteId,
    'Nome da Empresa': nomeEmpresa,
    CNPJ: `'${cnpj}`,
    Perdcomp_Numero: parsed.raw,
    Perdcomp_Formatado: parsed.formatted ?? '',
    B1: parsed.b1 ?? '',
    B2: parsed.b2 ?? '',
    Data_DDMMAA: parsed.dataDDMMAA ?? '',
    Data_ISO: parsed.dataISO ?? '',
    Tipo_Codigo: parsed.tipoNum?.toString() ?? '',
    Tipo_Nome: tipoNome,
    Natureza: parsed.natureza ?? '',
    Familia: parsed.familia ?? 'DESCONHECIDO',
    Credito_Codigo: creditoCodigo,
    Credito_Descricao: creditoDescricao || '(desconhecido)',
    Protocolo: parsed.protocolo ?? '',
    Situacao: item?.situacao ?? '',
    Situacao_Detalhamento: item?.situacao_detalhamento ?? '',
    Motivo_Normalizado: motivo,
    Solicitante: item?.solicitante ?? '',
    Fonte: inferFonte(item),
    Data_Consulta: dataConsulta
  };

  return base;
}

function formatCancelamentos(cancelamentos: string[]) {
  if (!cancelamentos.length) {
    return '';
  }
  return cancelamentos.join(';');
}

async function appendPerdcompItens({
  sheets,
  spreadsheetId,
  headers,
  rows
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  headers: string[];
  rows: Record<string, string>[];
}) {
  if (!rows.length) return;
  const values = rows.map(row => headers.map(header => row[header] ?? ''));
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'PERDCOMP_ITENS',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values
    }
  });
}

function buildResumoUpdates({
  headers,
  row,
  agregado,
  resumo
}: {
  headers: string[];
  row: string[] | undefined;
  agregado: Agregado;
  resumo: PerdcompResumo;
}) {
  const updates: Record<string, string> = {
    Qtd_PERDCOMP_TOTAL: agregado.total.toString(),
    Qtd_PERDCOMP_CANCEL: agregado.canc.toString(),
    Qtd_PERDCOMP_TOTAL_SEM_CANCEL: agregado.totalSemCancelamento.toString(),
    Qtd_PERDCOMP_DCOMP: agregado.porFamilia.DCOMP.toString(),
    Qtd_PERDCOMP_REST: agregado.porFamilia.REST.toString(),
    Qtd_PERDCOMP_RESSARC: agregado.porFamilia.RESSARC.toString(),
    TOP3_CREDITOS: buildTopCreditosString(agregado),
    SITUACOES_NORMALIZADAS: buildSituacoesString(agregado),
    Lista_PERDCOMP_CANCEL: formatCancelamentos(resumo.cancelamentos),
    Quantidade_PERDCOMP: agregado.totalSemCancelamento.toString()
  };

  const updatedRow = headers.map((header, index) => {
    if (updates[header] !== undefined) {
      return updates[header];
    }
    return row?.[index] ?? '';
  });

  return updatedRow;
}

function ensureDate(value?: string, fallback?: string) {
  if (!value) return fallback ?? todayISO();
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isoMatch) {
    return fallback ?? todayISO();
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    const rawCnpj = body?.cnpj ?? url.searchParams.get('cnpj') ?? '';
    const cnpj = padCNPJ14(rawCnpj);
    if (!isValidCNPJ(cnpj)) {
      return NextResponse.json(
        {
          error: true,
          httpStatus: 400,
          httpStatusText: 'Bad Request',
          message: 'CNPJ inválido'
        },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.SHEET_ID ?? process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('SHEET_ID (ou SPREADSHEET_ID) não configurado');
    }

    const clienteId =
      body?.Cliente_ID ??
      body?.clienteId ??
      url.searchParams.get('Cliente_ID') ??
      url.searchParams.get('clienteId');
    const empresaId =
      body?.Empresa_ID ??
      body?.empresaId ??
      url.searchParams.get('Empresa_ID') ??
      url.searchParams.get('empresaId');
    const nomeEmpresa =
      body?.Nome_da_Empresa ??
      body?.nomeEmpresa ??
      url.searchParams.get('Nome_da_Empresa') ??
      url.searchParams.get('nomeEmpresa');

    if (!clienteId || !nomeEmpresa) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    let dataFim = ensureDate(body?.data_fim ?? url.searchParams.get('data_fim') ?? todayISO());
    let dataInicio = ensureDate(body?.data_inicio ?? url.searchParams.get('data_inicio') ?? addYears(dataFim, -5));

    if (new Date(dataInicio) > new Date(dataFim)) {
      dataInicio = addYears(dataFim, -5);
    }

    const debugMode = Boolean(body?.debug);

    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) {
      throw new Error('INFOSIMPLES_TOKEN is not set');
    }

    await ensureMigration(spreadsheetId);

    const sheets = await getSheetsClient();
    const creditosDict = await loadCreditDictionary(sheets, spreadsheetId);

    const apiResponse = await fetchInfosimples({
      cnpj,
      data_inicio: dataInicio,
      data_fim: dataFim,
      token
    });

    const headerRequestedAt = apiResponse?.header?.requested_at ?? todayISO();
    const siteReceipt = apiResponse?.site_receipts?.[0] ?? null;
    const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp ?? [];
    const perdcompArray = Array.isArray(perdcompArrayRaw) ? (perdcompArrayRaw as InfosimplesItem[]) : [];

    const creditCodes = new Set<string>();
    for (const item of perdcompArray) {
      const parsed = parsePerdcompNumero(item?.perdcomp ?? '');
      if (parsed.valido && parsed.credito) {
        creditCodes.add(parsed.credito.padStart(2, '0'));
      }
      if (item?.tipo_credito) {
        creditCodes.add(String(item.tipo_credito).padStart(2, '0'));
      }
    }

    await appendMissingCredits({
      sheets,
      spreadsheetId,
      creditosDict,
      codigos: creditCodes
    });

    const agregado = agregaPerdcomp(
      perdcompArray
        .filter(item => typeof item?.perdcomp === 'string' && item.perdcomp)
        .map(item => ({
          perdcomp: String(item.perdcomp),
          situacao: item?.situacao,
          situacao_detalhamento: item?.situacao_detalhamento,
          tipo_credito: item?.tipo_credito
        })),
      creditosDict
    );

    const resumo = toPerdcompResumo(agregado);

    const { headers: itensHeaders, keys: existingKeys } = await loadExistingItemKeys({
      sheets,
      spreadsheetId
    });

    const itensRows: Record<string, string>[] = [];
    for (const item of perdcompArray) {
      const parsed = parsePerdcompNumero(item?.perdcomp ?? '');
      if (!parsed.valido || !parsed.formatted) continue;
      const key = `${cnpj}|${parsed.raw}`;
      if (existingKeys.has(key)) {
        continue;
      }
      const row = buildPerdcompItemRow({
        item,
        parsed,
        clienteId,
        empresaId,
        nomeEmpresa,
        cnpj,
        creditosDict,
        dataConsulta: headerRequestedAt
      });
      itensRows.push(row);
      existingKeys.add(key);
    }

    await appendPerdcompItens({
      sheets,
      spreadsheetId,
      headers: itensHeaders,
      rows: itensRows
    });

    const { headers: perdcompHeaders, rows: perdcompRows } = await loadPerdcompRows({
      sheets,
      spreadsheetId
    });

    const cnpjIndex = perdcompHeaders.indexOf('CNPJ');
    const clienteIndex = perdcompHeaders.indexOf('Cliente_ID');

    let rowIndex = -1;
    for (let i = 0; i < perdcompRows.length; i += 1) {
      const row = perdcompRows[i];
      const rowCnpj = String(row?.[cnpjIndex] ?? '').replace(/\D/g, '');
      const rowCliente = String(row?.[clienteIndex] ?? '').trim();
      if (rowCnpj === cnpj || (rowCliente && rowCliente === clienteId)) {
        rowIndex = i;
        break;
      }
    }

    const updatedRowValues = buildResumoUpdates({
      headers: perdcompHeaders,
      row: rowIndex >= 0 ? perdcompRows[rowIndex] : undefined,
      agregado,
      resumo
    });

    if (rowIndex >= 0) {
      const startRow = rowIndex + 2;
      const endColumnLetter = columnNumberToLetter(perdcompHeaders.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `PERDCOMP!A${startRow}:${endColumnLetter}${startRow}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [updatedRowValues]
        }
      });
    } else {
      const newRow = perdcompHeaders.map(header => {
        switch (header) {
          case 'Cliente_ID':
            return clienteId;
          case 'Empresa_ID':
            return empresaId ?? clienteId;
          case 'Nome da Empresa':
            return nomeEmpresa;
          case 'CNPJ':
            return `'${cnpj}`;
          case 'Data_Consulta':
            return headerRequestedAt;
          case 'URL_Comprovante_HTML':
            return siteReceipt ?? '';
          default:
            return '';
        }
      });

      for (let i = 0; i < updatedRowValues.length; i += 1) {
        if (updatedRowValues[i]) {
          newRow[i] = updatedRowValues[i];
        }
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'PERDCOMP',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow]
        }
      });
    }

    const response: any = {
      ok: true,
      cnpj,
      perdcomp: perdcompArray,
      perdcompResumo: resumo,
      perdcompItens: debugMode ? itensRows : undefined,
      mappedCount: apiResponse?.mapped_count ?? agregado.total,
      header: {
        requested_at: headerRequestedAt
      },
      site_receipt: siteReceipt
    };

    if (debugMode) {
      response.debug = {
        apiResponse,
        agregado,
        resumo,
        itensNovos: itensRows.length
      };
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    return NextResponse.json(
      {
        error: true,
        httpStatus: error?.status ?? 502,
        httpStatusText: error?.statusText ?? 'Bad Gateway',
        providerCode: error?.providerCode ?? null,
        providerMessage: error?.providerMessage ?? error?.message ?? 'API error'
      },
      { status: error?.status ?? 502 }
    );
  }
}

