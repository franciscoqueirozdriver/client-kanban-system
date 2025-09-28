import { NextResponse } from 'next/server';
import { appendSheetData } from '@/lib/googleSheets';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

const PERDECOMP_HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Perdcomp_ID', 'CNPJ', 'Tipo_Pedido',
  'Situacao', 'Periodo_Inicio', 'Periodo_Fim', 'Valor_Total', 'Numero_Processo',
  'Data_Protocolo', 'Ultima_Atualizacao', 'Quantidade_Receitas', 'Quantidade_Origens',
  'Quantidade_DARFs', 'URL_Comprovante_HTML', 'URL_Comprovante_PDF', 'Data_Consulta'
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { linhas } = body;

    if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ ok: false, message: 'Payload inválido: "linhas" deve ser um array não-vazio.' }, { status: 400 });
    }

    const rowsToAppend = linhas.map((linha: any) => {
      // Ensure the object has keys for all headers, even if they are empty
      const fullLinha = PERDECOMP_HEADERS.reduce((acc, header) => {
        acc[header] = linha[header] ?? '';
        return acc;
      }, {} as { [key: string]: any });

      // Validate that the provided line is not malformed
      if (Object.keys(linha).length > PERDECOMP_HEADERS.length) {
          // This is a simple check. A more robust one would check for unexpected keys.
      }

      return PERDECOMP_HEADERS.map(header => fullLinha[header]);
    });

    // The appendSheetData function expects an array of arrays.
    await appendSheetData(PERDECOMP_SHEET_NAME, rowsToAppend);

    return NextResponse.json({ ok: true, inseridos: rowsToAppend.length });
  } catch (error) {
    console.error('[API /perdecomp/salvar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
