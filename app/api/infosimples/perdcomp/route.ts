import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import { agregaPerdcomp } from '@/utils/perdcomp';

export const runtime = 'nodejs';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

const REQUIRED_HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Perdcomp_ID', 'CNPJ', 'Tipo_Pedido',
  'Situacao', 'Periodo_Inicio', 'Periodo_Fim', 'Quantidade_PERDCOMP',
  'Qtd_PERDCOMP_DCOMP', 'Qtd_PERDCOMP_REST', 'Qtd_PERDCOMP_CANCEL',
  'Numero_Processo', 'Data_Protocolo', 'Ultima_Atualizacao',
  'Quantidade_Receitas', 'Quantidade_Origens', 'Quantidade_DARFs',
  'URL_Comprovante_HTML', 'URL_Comprovante_PDF', 'Data_Consulta',
  'Tipo_Empresa', 'Concorrentes',
  'Code', 'Code_Message', 'MappedCount', 'Perdcomp_Principal_ID',
  'Perdcomp_Solicitante', 'Perdcomp_Tipo_Documento',
  'Perdcomp_Tipo_Credito', 'Perdcomp_Data_Transmissao',
  'Perdcomp_Situacao', 'Perdcomp_Situacao_Detalhamento'
];

function columnNumberToLetter(columnNumber: number) {
  let temp;
  let letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addYears(dateISO: string, years: number) {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function jitter(base: number) {
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delays = [1500, 3000, 5000]): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status ?? err?.status ?? 0;
      const shouldRetry = status >= 500 || status === 0;
      if (!shouldRetry || i === attempts - 1) throw err;
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastErr;
}

async function getLastPerdcompFromSheet({
  cnpj,
  clienteId,
}: {
  cnpj?: string;
  clienteId?: string;
}) {
  const sheets = await getSheetsClient();
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'PERDECOMP!1:1',
  });
  const headers = head.data.values?.[0] || [];
  const col = (name: string) => headers.indexOf(name);
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'PERDECOMP!A2:Z',
  });
  const rows = resp.data.values || [];
  const idxCliente = col('Cliente_ID');
  const idxCnpj = col('CNPJ');
  const idxQtd = col('Quantidade_PERDCOMP');
  const idxHtml = col('URL_Comprovante_HTML');
  const idxData = col('Data_Consulta');
  const idxQtdDcomp = col('Qtd_PERDCOMP_DCOMP');
  const idxQtdRest = col('Qtd_PERDCOMP_REST');
  const idxQtdCancel = col('Qtd_PERDCOMP_CANCEL');
  const match = rows.find(
    r =>
      (clienteId && r[idxCliente] === clienteId) ||
      (cnpj && (r[idxCnpj] || '').replace(/\D/g, '') === cnpj)
  );
  if (!match) return null;
  const qtd = Number(match[idxQtd] ?? 0);
  const dcomp = Number(match[idxQtdDcomp] ?? 0);
  const rest = Number(match[idxQtdRest] ?? 0);
  const canc = Number(match[idxQtdCancel] ?? 0);
  return {
    quantidade: qtd || 0,
    dcomp,
    rest,
    canc,
    site_receipt: match[idxHtml] || null,
    requested_at: match[idxData] || null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    const rawCnpj = body?.cnpj ?? url.searchParams.get('cnpj') ?? '';
    const cnpj = padCNPJ14(rawCnpj);
    if (!isValidCNPJ(cnpj)) {
      return NextResponse.json(
        { error: true, httpStatus: 400, httpStatusText: 'Bad Request', message: 'CNPJ inválido' },
        { status: 400 }
      );
    }

    let data_fim = (body?.data_fim ?? url.searchParams.get('data_fim') ?? '').toString().slice(0, 10);
    let data_inicio = (body?.data_inicio ?? url.searchParams.get('data_inicio') ?? '').toString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) {
      data_inicio = addYears(data_fim, -5);
    }

    const force = body?.force ?? false;
    const debugMode = body?.debug ?? false;
    const clienteId =
      body?.Cliente_ID ??
      body?.clienteId ??
      url.searchParams.get('Cliente_ID') ??
      url.searchParams.get('clienteId');
    const nomeEmpresa =
      body?.Nome_da_Empresa ??
      body?.nomeEmpresa ??
      url.searchParams.get('Nome_da_Empresa') ??
      url.searchParams.get('nomeEmpresa');
    if (!clienteId || !nomeEmpresa) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const requestedAt = new Date().toISOString();
    const apiRequest = {
      cnpj,
      data_inicio,
      data_fim,
      timeout: 600,
      endpoint: 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp',
    };

    // 1. If not forcing, check the spreadsheet first
    if (!force) {
      const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

      const dataForCnpj = rows.filter(row => {
        const rowCnpj = padCNPJ14(row.CNPJ);
        return row.Cliente_ID === clienteId || rowCnpj === cnpj;
      });

      if (dataForCnpj.length > 0) {
        const lastConsulta = dataForCnpj.reduce((acc, r) => {
          const dc = r.Data_Consulta;
          // Only consider valid-looking dates (basic ISO format check)
          if (!dc || typeof dc !== 'string' || !dc.startsWith('20')) return acc;
          try {
            // Check if dates are valid before comparing
            const d1 = new Date(dc);
            if (isNaN(d1.getTime())) return acc;
            if (!acc) return dc;
            const d2 = new Date(acc);
            if (isNaN(d2.getTime())) return dc;
            return d1 > d2 ? dc : acc;
          } catch {
            return acc;
          }
        }, '');

        const rawQtd = dataForCnpj[0]?.Quantidade_PERDCOMP ?? '0';
        const totalSemCancelamento = parseInt(String(rawQtd).replace(/\D/g, ''), 10) || 0;
        const dcomp = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_DCOMP ?? '0').replace(/\D/g, ''), 10) || 0;
        const rest = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_REST ?? '0').replace(/\D/g, ''), 10) || 0;
        const canc = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_CANCEL ?? '0').replace(/\D/g, ''), 10) || 0;
        const porTipo = { DCOMP: dcomp, REST: rest, CANC: canc, DESCONHECIDO: 0 };
        const porNatureza: Record<string, number> = {};
        if (dcomp) porNatureza['1.3'] = dcomp;
        if (rest) porNatureza['1.2'] = rest;
        if (canc) porNatureza['1.8'] = canc;
        const resumo = {
          total: dcomp + rest + canc,
          totalSemCancelamento,
          porTipo,
          porNatureza,
        };
        const resp: any = {
          ok: true,
          fonte: 'planilha',
          linhas: dataForCnpj,
          perdcompResumo: resumo,
          total_perdcomp: resumo.total,
        };
        if (debugMode) {
          resp.debug = {
            requestedAt,
            fonte: 'planilha',
            apiRequest,
            apiResponse: null,
            mappedCount: dataForCnpj.length,
            header: { requested_at: lastConsulta },
            total_perdcomp: resumo.total,
          };
        }
        return NextResponse.json(resp);
      }
    }

    // 2. If forced or no data found, call the Infosimples API
    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) {
      throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
    }

    const params = new URLSearchParams({
      token: token,
      cnpj: cnpj,
      data_inicio: data_inicio,
      data_fim: data_fim,
      timeout: '600',
    });

    const doCall = async () => {
      const resp = await fetch(apiRequest.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const text = await resp.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
      if (!resp.ok || (json && typeof json.code === 'number' && json.code !== 200)) {
        const err: any = new Error('provider_error');
        err.status = resp.status || 502;
        err.statusText = resp.statusText || 'Bad Gateway';
        err.providerCode = json?.code;
        err.providerMessage =
          json?.code_message || json?.message || json?.errors?.[0]?.message || null;
        throw err;
      }
      return json;
    };

    let apiResponse: any;
    try {
      apiResponse = await withRetry(doCall, 3, [1500, 3000, 5000]);
    } catch (err: any) {
      const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
      return NextResponse.json(
        {
          error: true,
          httpStatus: err?.status || 502,
          httpStatusText: err?.statusText || 'Bad Gateway',
          providerCode: err?.providerCode ?? null,
          providerMessage: err?.providerMessage ?? err?.message ?? 'API error',
          fallback,
        },
        { status: err?.status || 502 }
      );
    }

    if (debugMode && apiResponse?.header?.parameters?.token) {
      delete apiResponse.header.parameters.token;
    }

    const headerRequestedAt = apiResponse?.header?.requested_at || requestedAt;
    const perdcompArrayRaw = apiResponse?.data?.[0]?.perdcomp;
    const perdcompArray = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];
    const resumo = agregaPerdcomp(perdcompArray);
    const first = perdcompArray[0] || {};
    const totalPerdcomp = resumo.total;
    const mappedCount = apiResponse?.mapped_count || totalPerdcomp;
    const siteReceipt = apiResponse?.site_receipts?.[0] || '';

    const writes: Record<string, any> = {
      Code: apiResponse.code,
      Code_Message: apiResponse.code_message || '',
      MappedCount: mappedCount,
      Quantidade_PERDCOMP: resumo.totalSemCancelamento,
      Qtd_PERDCOMP_DCOMP: resumo.porTipo.DCOMP,
      Qtd_PERDCOMP_REST: resumo.porTipo.REST,
      Qtd_PERDCOMP_CANCEL: resumo.porTipo.CANC,
      URL_Comprovante_HTML: siteReceipt,
      Data_Consulta: headerRequestedAt,
      Perdcomp_Principal_ID: first?.perdcomp || '',
      Perdcomp_Solicitante: first?.solicitante || '',
      Perdcomp_Tipo_Documento: first?.tipo_documento || '',
      Perdcomp_Tipo_Credito: first?.tipo_credito || '',
      Perdcomp_Data_Transmissao: first?.data_transmissao || '',
      Perdcomp_Situacao: first?.situacao || '',
      Perdcomp_Situacao_Detalhamento: first?.situacao_detalhamento || '',
    };

    const sheets = await getSheetsClient();
    // Call getSheetData ONCE and get both headers and rows
    const { headers, rows } = await getSheetData(PERDECOMP_SHEET_NAME);
    const finalHeaders = [...headers];
    let headerUpdated = false;
    for (const h of REQUIRED_HEADERS) {
      if (!finalHeaders.includes(h)) {
        finalHeaders.push(h);
        headerUpdated = true;
      }
    }
    if (headerUpdated) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: `${PERDECOMP_SHEET_NAME}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [finalHeaders] },
      });
    }

    // Use the 'rows' we already fetched instead of calling getSheetData again
    let rowNumber = -1;
    for (const r of rows) {
      if (r.Cliente_ID === clienteId || String(r.CNPJ || '').replace(/\D/g, '') === cnpj) {
        rowNumber = r._rowNumber;
        break;
      }
    }

    if (rowNumber !== -1) {
      const data = [] as any[];
      for (const [key, value] of Object.entries(writes)) {
        if (value === undefined || value === '') continue;
        const colIndex = finalHeaders.indexOf(key);
        if (colIndex === -1) continue;
        const colLetter = columnNumberToLetter(colIndex + 1);
        data.push({
          range: `${PERDECOMP_SHEET_NAME}!${colLetter}${rowNumber}`,
          values: [[value]],
        });
      }
      if (data.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.SPREADSHEET_ID!,
          requestBody: { valueInputOption: 'RAW', data },
        });
      }
    } else {
      const row: Record<string, any> = {};
      finalHeaders.forEach(h => (row[h] = ''));
      row['Cliente_ID'] = clienteId;
      row['Nome da Empresa'] = nomeEmpresa;
      row['CNPJ'] = `'${cnpj}`;
      for (const [k, v] of Object.entries(writes)) {
        if (v !== undefined) row[k] = v;
      }
      const values = finalHeaders.map(h => row[h]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: PERDECOMP_SHEET_NAME,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }

    const resp: any = {
      ok: true,
      header: { requested_at: headerRequestedAt },
      mappedCount,
      total_perdcomp: totalPerdcomp,
      site_receipt: siteReceipt,
      perdcomp: perdcompArray,
      perdcompResumo: resumo,
      primeiro: {
        perdcomp: first?.perdcomp,
        solicitante: first?.solicitante,
        tipo_documento: first?.tipo_documento,
        tipo_credito: first?.tipo_credito,
        data_transmissao: first?.data_transmissao,
        situacao: first?.situacao,
        situacao_detalhamento: first?.situacao_detalhamento,
      },
      cnpj,
    };
    if (debugMode) {
      resp.debug = {
        requestedAt,
        fonte: 'api',
        apiRequest,
        apiResponse,
        mappedCount,
        siteReceipts: apiResponse?.site_receipts,
        header: apiResponse?.header,
        total_perdcomp: totalPerdcomp,
        perdcompResumo: resumo,
      };
    }

    return NextResponse.json(resp);

  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    return NextResponse.json(
      {
        error: true,
        httpStatus: 502,
        httpStatusText: 'Bad Gateway',
        providerCode: null,
        providerMessage: error?.message || 'API error',
      },
      { status: 502 }
    );
  }
}
