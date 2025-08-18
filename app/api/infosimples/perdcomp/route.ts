import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { consultarPerdcomp } from '../../../../lib/infosimples';
import { isValidCNPJ } from '../../../../lib/isValidCNPJ';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      cnpj,
      periodoInicio,
      periodoFim,
      force = false,
      debug: debugMode = false,
      clienteId,
      nomeEmpresa,
    } = body;

    if (!cnpj || !periodoInicio || !periodoFim || !clienteId || !nomeEmpresa) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const cleanCnpj = String(cnpj).replace(/\D/g, '');
    if (!isValidCNPJ(cleanCnpj)) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
    }

    const requestedAt = new Date().toISOString();
    const apiRequest = { cnpj: cleanCnpj, timeout: 600, endpoint: 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp' };

    // 1. If not forcing, check the spreadsheet first
    if (!force) {
      const { rows, headers } = await getSheetData(PERDECOMP_SHEET_NAME);

      const dataForCnpj = rows.filter(row => {
        const rowCnpj = String(row.CNPJ || '').replace(/\D/g, '');
        return row.Cliente_ID === clienteId || rowCnpj === cleanCnpj;
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
    const apiResponse = await consultarPerdcomp({
      cnpj: cleanCnpj,
      data_inicio: periodoInicio,
      data_fim: periodoFim,
      timeout: 600,
    });
    if (debugMode && apiResponse?.header?.parameters?.token) {
      delete apiResponse.header.parameters.token;
    }

    if (apiResponse.code !== 200) {
      throw new Error(`Infosimples code ${apiResponse.code}: ${apiResponse.code_message}`);
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
    const hasJson = finalHeaders.includes('JSON_Bruto');
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
      if (r.Cliente_ID === clienteId || String(r.CNPJ || '').replace(/\D/g, '') === cleanCnpj) {
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
      if (hasJson) {
        const colIndex = finalHeaders.indexOf('JSON_Bruto');
        if (colIndex !== -1) {
          const colLetter = columnNumberToLetter(colIndex + 1);
          data.push({ range: `${PERDECOMP_SHEET_NAME}!${colLetter}${rowNumber}`, values: [[JSON.stringify(apiResponse)]] });
        }
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
      row['CNPJ'] = cleanCnpj;
      for (const [k, v] of Object.entries(writes)) {
        if (v !== undefined) row[k] = v;
      }
      if (hasJson) row['JSON_Bruto'] = JSON.stringify(apiResponse);
      const values = finalHeaders.map(h => row[h]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: PERDECOMP_SHEET_NAME,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }

    const resp: any = { ok: true, fonte: 'api' };
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

  } catch (error) {
    console.error('[API /infosimples/perdcomp]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
