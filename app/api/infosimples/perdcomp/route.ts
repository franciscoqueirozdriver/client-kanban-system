import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { consultarPerdcomp } from '../../../../lib/infosimples';

export const runtime = 'nodejs';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

function generatePerdcompId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PDC-${datePart}-${timePart}-${randomPart}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cnpj, periodoInicio, periodoFim, force = false, debug: debugMode = false } = body;

    if (!cnpj || !periodoInicio || !periodoFim) {
      return NextResponse.json({ message: 'Missing required fields: cnpj, periodoInicio, periodoFim' }, { status: 400 });
    }

    const cleanCnpj = String(cnpj).replace(/\D/g, '');
    const requestedAt = new Date().toISOString();
    const apiRequest = { cnpj: cleanCnpj, timeout: 600, endpoint: 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp' };

    // 1. If not forcing, check the spreadsheet first
    if (!force) {
      const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

      const dataForCnpj = rows.filter(row => {
        const rowCnpj = String(row.CNPJ || '').replace(/\D/g, '');
        return rowCnpj === cleanCnpj;
      });

      if (dataForCnpj.length > 0) {
        // If any data exists for this CNPJ, return it.
        // The frontend will filter it by the selected date range for display.
        // This allows the UI to show the most recent 'Data_Consulta' even if it's outside the user's range.
        const resp: any = { ok: true, fonte: 'planilha', linhas: dataForCnpj };
        if (debugMode) {
          resp.debug = {
            requestedAt,
            fonte: 'planilha',
            apiRequest,
            apiResponse: null,
            mappedCount: dataForCnpj.length,
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

    const dataConsulta = new Date().toISOString();
    const mappedItems: any[] = [];
    for (const d of apiResponse.data || []) {
      const receipt = d.site_receipt || '';
      for (const p of d.perdcomp || []) {
        const isPdf = receipt.toLowerCase().endsWith('.pdf');
        mappedItems.push({
          Cliente_ID: '',
          Nome_da_Empresa: p.solicitante || '',
          Perdcomp_ID: generatePerdcompId(),
          CNPJ: cleanCnpj,
          Tipo_Pedido: p.tipo_documento || '',
          Situacao: p.situacao || '',
          Periodo_Inicio: p.periodo_apuracao_inicio || '',
          Periodo_Fim: p.periodo_apuracao_fim || '',
          Valor_Total: 0,
          Numero_Processo: p.numero_processo || '',
          Data_Protocolo: p.data_transmissao || '',
          Ultima_Atualizacao: p.ultima_atualizacao || '',
          Quantidade_Receitas: 0,
          Quantidade_Origens: 0,
          Quantidade_DARFs: 0,
          URL_Comprovante_HTML: !isPdf ? receipt : '',
          URL_Comprovante_PDF: isPdf ? receipt : '',
          Data_Consulta: dataConsulta,
        });
      }
    }

    const resp: any = { ok: true, fonte: 'api', itens: mappedItems };
    if (debugMode) {
      resp.debug = {
        requestedAt,
        fonte: 'api',
        apiRequest,
        apiResponse,
        mappedCount: mappedItems.length,
        siteReceipts: apiResponse?.site_receipts,
        header: apiResponse?.header,
      };
    }

    return NextResponse.json(resp);

  } catch (error) {
    console.error('[API /infosimples/perdcomp]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
