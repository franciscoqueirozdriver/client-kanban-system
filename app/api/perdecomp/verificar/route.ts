import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { normalizeCnpj } from '@/lib/normalizers';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCnpj = searchParams.get('cnpj')?.trim();

  if (!rawCnpj) {
    return NextResponse.json({ message: 'Query parameter "cnpj" is required' }, { status: 400 });
  }

  let cleanCnpj;
  try {
    cleanCnpj = normalizeCnpj(rawCnpj);
  } catch (error: any) {
    return NextResponse.json({ message: 'Invalid CNPJ format', error: error.message }, { status: 400 });
  }

  try {
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    const dataForCnpj = rows.filter(row => {
      const rowCnpj = normalizeCnpj(row.CNPJ);
      return rowCnpj === cleanCnpj;
    });

    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Find the most recent consultation date
    const mostRecentConsultation = dataForCnpj.reduce((latest, row) => {
      const currentDate = new Date(row.Data_Consulta);
      if (!latest || currentDate > new Date(latest)) {
        return row.Data_Consulta;
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
