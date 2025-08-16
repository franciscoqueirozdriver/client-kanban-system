import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { consultarPerdcomp } from '../../../../lib/infosimples';

type ContagemPorTipo = Record<string, number>;

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
      const existingData = rows.filter(row => {
        const rowCnpj = String(row.CNPJ || '').replace(/\D/g, '');
        if (rowCnpj !== cleanCnpj) return false;
        const rowDate = row.Periodo_Fim || row.Data_Consulta?.slice(0, 10);
        return rowDate >= periodoInicio && rowDate <= periodoFim;
      });

      if (existingData.length > 0) {
        const contagemPorTipoDocumento = existingData.reduce((acc, row) => {
          const tipo = row.Tipo_Pedido || '—';
          acc[tipo] = (acc[tipo] || 0) + 1;
          return acc;
        }, {} as ContagemPorTipo);
        const nomeDetectado = existingData[0]?.Solicitante || existingData[0]?.['Nome da Empresa'] || '';
        return NextResponse.json({
          ok: true,
          fonte: 'planilha',
          nomeDetectado,
          quantidadePerdcomp: existingData.length,
          contagemPorTipoDocumento,
          linhas: existingData,
        });
      }
    }

    // 2. If forced or no data found, call the Infosimples API
    const apiResponse = await consultarPerdcomp({ cnpj: cleanCnpj });

    // Assuming apiResponse.data contains the list of PER/DCOMPs
    const items = apiResponse?.data || [];
    const nomeDetectado = items.find((i: any) => i.solicitante)?.solicitante || '';
    const contagemPorTipoDocumento = items.reduce((acc: ContagemPorTipo, item: any) => {
      const tipo = item.tipo_documento || '—';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as ContagemPorTipo);

    const dataConsulta = new Date().toISOString();

    // 3. Map the API response to the 18-column format
    const mappedItems = items.map((item: any) => ({
      Cliente_ID: '',
      'Nome da Empresa': nomeDetectado || '',
      Perdcomp_ID: generatePerdcompId(),
      CNPJ: cleanCnpj,
      Tipo_Pedido: item.tipo_pedido || 'N/A',
      Situacao: item.situacao || 'N/A',
      Periodo_Inicio: item.periodo_apuracao_inicio || '',
      Periodo_Fim: item.periodo_apuracao_fim || '',
      Valor_Total: '',
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

    return NextResponse.json({
      ok: true,
      fonte: 'api',
      code: apiResponse.code,
      code_message: apiResponse.code_message,
      nomeDetectado,
      quantidadePerdcomp: items.length,
      contagemPorTipoDocumento,
      linhasParaSalvar: mappedItems,
    });

  } catch (error) {
    console.error('[API /infosimples/perdcomp]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
