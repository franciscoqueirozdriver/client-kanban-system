import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { consultarPerdcomp } from '../../../../lib/infosimples';

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
    const { cnpj, periodoInicio, periodoFim, force = false } = body;

    if (!cnpj || !periodoInicio || !periodoFim) {
      return NextResponse.json({ message: 'Missing required fields: cnpj, periodoInicio, periodoFim' }, { status: 400 });
    }

    const cleanCnpj = String(cnpj).replace(/\D/g, '');

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
        return NextResponse.json({ ok: true, fonte: 'planilha', linhas: dataForCnpj });
      }
    }

    // 2. If forced or no data found, call the Infosimples API
    const apiResponse = await consultarPerdcomp({ cnpj: cleanCnpj });

    // Assuming apiResponse.data contains the list of PER/DCOMPs
    const items = apiResponse?.data || [];

    const dataConsulta = new Date().toISOString();

    // 3. Map the API response to the 18-column format
    const mappedItems = items.map((item: any) => ({
      // Cliente_ID and Nome da Empresa will be added by the frontend before saving
      Cliente_ID: '',
      Nome_da_Empresa: '',
      Perdcomp_ID: generatePerdcompId(),
      CNPJ: cleanCnpj,
      Tipo_Pedido: item.tipo_pedido || 'N/A',
      Situacao: item.situacao || 'N/A',
      Periodo_Inicio: item.periodo_apuracao_inicio || '',
      Periodo_Fim: item.periodo_apuracao_fim || '',
      Valor_Total: item.valor_credito_total || 0,
      Numero_Processo: item.numero_processo || '',
      Data_Protocolo: item.data_protocolo || '',
      Ultima_Atualizacao: item.ultima_atualizacao || '',
      Quantidade_Receitas: item.receitas?.length || 0,
      Quantidade_Origens: item.origens_credito?.length || 0,
      Quantidade_DARFs: item.darfs?.length || 0,
      URL_Comprovante_HTML: item.site_receipts?.html || '',
      URL_Comprovante_PDF: item.site_receipts?.pdf || '',
      Data_Consulta: dataConsulta,
    }));

    return NextResponse.json({ ok: true, fonte: 'api', itens: mappedItems });

  } catch (error) {
    console.error('[API /infosimples/perdcomp]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
