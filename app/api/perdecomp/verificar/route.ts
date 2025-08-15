import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.replace(/\D/g, '');

  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ message: 'CNPJ inválido fornecido.' }, { status: 400 });
  }

  try {
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    const consultations = rows
      .filter(row => row.CNPJ?.replace(/\D/g, '') === cnpj)
      .map(row => row.Data_Consulta)
      .filter(Boolean); // Remove any empty or null dates

    if (consultations.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Sort dates to find the most recent one
    consultations.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return NextResponse.json({ lastConsultation: consultations[0] });
  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido';
    return NextResponse.json({ message: 'Falha ao verificar consulta', error: errorMessage }, { status: 500 });
  }
}
