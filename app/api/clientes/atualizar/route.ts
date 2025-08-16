import { NextResponse } from 'next/server';
import { updateRowData } from '../../../../lib/googleSheets.js';

export async function POST(request: Request) {
  try {
    // The frontend must pass the sheet name and the exact row number to update
    const { sheetName, rowNumber, data } = await request.json();

    if (!sheetName || !rowNumber || !data) {
      return NextResponse.json({ message: 'Dados insuficientes para atualização: sheetName, rowNumber e data são obrigatórios.' }, { status: 400 });
    }

    // The data object should contain the column headers as keys
    await updateRowData(sheetName, rowNumber, data);

    return NextResponse.json({ ok: true, message: 'Lead atualizado com sucesso!' });
  } catch (error) {
    console.error('[API /clientes/atualizar]', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
