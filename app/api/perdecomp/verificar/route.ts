import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cnpj = padCNPJ14(url.searchParams.get('cnpj') ?? '');

  if (!isValidCNPJ(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    const { rows, headers } = await getSheetData(PERDECOMP_SHEET_NAME);

    const cnpjColIndex = headers.indexOf('CNPJ');
    const dateColIndex = headers.indexOf('Data_Consulta');

    if (cnpjColIndex === -1 || dateColIndex === -1) {
      // This can happen if the sheet is new/empty. It's not a server error.
      return NextResponse.json({ lastConsultation: null });
    }

    const matchedRow = rows.find(row => padCNPJ14(row[cnpjColIndex]) === cnpj);

    if (matchedRow && matchedRow[dateColIndex]) {
      return NextResponse.json({ lastConsultation: matchedRow[dateColIndex] });
    }

    return NextResponse.json({ lastConsultation: null });

  } catch (error: any) {
    // If the sheet/range doesn't exist, it's not an error, just means no last consultation.
    if (error?.message?.includes('Unable to parse range')) {
        return NextResponse.json({ lastConsultation: null });
    }
    console.error('Error fetching from Google Sheets:', error);
    return NextResponse.json({ error: 'Erro ao acessar a planilha.' }, { status: 500 });
  }
}