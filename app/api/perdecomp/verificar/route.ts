import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { padCNPJ14 } from '@/utils/cnpj';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!cnpj) {
    return NextResponse.json({ message: 'Query parameter "cnpj" is required' }, { status: 400 });
  }

  const cleanCnpj = padCNPJ14(cnpj);

  try {
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    const dataForCnpj = rows.filter(row => {
      const rowCnpj = padCNPJ14(row.CNPJ);
      return rowCnpj === cleanCnpj;
    });

    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Find the most recent consultation date robustly
    const mostRecentConsultation = dataForCnpj
      .map(row => row.Data_Consulta)
      .filter(dateStr => dateStr && typeof dateStr === 'string') // Filter out null/undefined/empty
      .map(dateStr => new Date(dateStr))
      .filter(date => !isNaN(date.getTime())) // Filter out invalid dates
      .sort((a, b) => b.getTime() - a.getTime())[0]; // Sort descending

    const lastConsultation = mostRecentConsultation ? mostRecentConsultation.toISOString() : null;

    return NextResponse.json({ lastConsultation });

  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to verify consultation', error: errorMessage }, { status: 500 });
  }
}
