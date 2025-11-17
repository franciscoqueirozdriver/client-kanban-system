import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import { padCNPJ14 } from '@/utils/cnpj';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!cnpj) {
    return NextResponse.json({ message: 'Query parameter "cnpj" is required' }, { status: 400 });
  }

  const cleanCnpj = padCNPJ14(cnpj);

  try {
    const { rows } = await getSheetData(SHEETS.PERDECOMP_SNAPSHOT);

    const dataForCnpj = rows.filter(row => {
      const rowCnpj = padCNPJ14(String(row.cnpj || ''));
      return rowCnpj === cleanCnpj;
    });

    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Find the most recent consultation date
    const mostRecentConsultation = dataForCnpj.reduce((latest, row) => {
      const currentDateStr = String(row.data_consulta || '');
      if (!currentDateStr) return latest;
      const currentDate = new Date(currentDateStr);
      if (!latest || currentDate > new Date(latest)) {
        return currentDateStr;
      }
      return latest;
    }, '' as string | null);

    return NextResponse.json({ lastConsultation: mostRecentConsultation });

  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to verify consultation', error: errorMessage }, { status: 500 });
  }
}
