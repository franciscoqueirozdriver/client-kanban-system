import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';

export const runtime = 'nodejs';

const PERDECOMP_SHEET_NAME = 'PEREDCOMP';

const REQUIRED_HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Perdcomp_ID', 'CNPJ', 'Tipo_Pedido',
  'Situacao', 'Periodo_Inicio', 'Periodo_Fim', 'Quantidade_PERDCOMP',
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
    const clienteId = body?.clienteId;
    const nomeEmpresa = body?.nomeEmpresa;
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
          const dc = r.Data_Consulta || '';
          return !acc || new Date(dc) > new Date(acc) ? dc : acc;
        }, '');
        const totalPerdcomp = Number(dataForCnpj[0]?.Quantidade_PERDCOMP || 0);
        const resp: any = { ok: true, fonte: 'planilha', linhas: dataForCnpj };
        if (debugMode) {
          resp.debug = {
            requestedAt,
            fonte: 'planilha',
            apiRequest,
            apiResponse: null,
            mappedCount: dataForCnpj.length,
            header: { requested_at: lastConsulta },
            total_perdcomp: totalPerdcomp,
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

    const params = new URLSearchParams();
    params.append('token', token);
    params.append('cnpj', cnpj);
    params.append('data_inicio', data_inicio);
    params.append('data_fim', data_fim);
    params.append('timeout', '600');

    const apiRes = await fetch(apiRequest.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await apiRes.text();
    const maybeJson = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    if (!apiRes.ok || (maybeJson && typeof maybeJson.code === 'number' && maybeJson.code !== 200)) {
      const httpStatus = apiRes.status || 500;
      const httpStatusText = apiRes.statusText || 'Error';
      const providerCode = maybeJson?.code;
      const providerMessage =
        maybeJson?.code_message ||
        maybeJson?.message ||
        maybeJson?.errors?.[0]?.message ||
        null;
      return NextResponse.json(
        {
          error: true,
          httpStatus,
          httpStatusText,
          providerCode,
          providerMessage,
          params: { cnpj, data_inicio, data_fim },
        },
        { status: httpStatus }
      );
    }

    const apiResponse = maybeJson || {};
    if (debugMode && apiResponse?.header?.parameters?.token) {
      delete apiResponse.header.parameters.token;
    }

    const headerRequestedAt = apiResponse?.header?.requested_at || requestedAt;
    const first = apiResponse?.data?.[0]?.perdcomp?.[0] || {};
    const totalPerdcomp = apiResponse?.data?.[0]?.perdcomp?.length || 0;
    const mappedCount = apiResponse?.mapped_count || totalPerdcomp;
    const siteReceipt = apiResponse?.site_receipts?.[0] || '';

    const writes: Record<string, any> = {
      Code: apiResponse.code,
      Code_Message: apiResponse.code_message || '',
      MappedCount: mappedCount,
      Quantidade_PERDCOMP: totalPerdcomp,
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
    const { headers } = await getSheetData(PERDECOMP_SHEET_NAME);
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

    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);
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
