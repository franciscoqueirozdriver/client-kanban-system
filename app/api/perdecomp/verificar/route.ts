import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { padCNPJ14 } from '@/utils/cnpj';
import { normalizarNomeEmpresa } from '@/utils/clienteId';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpjParam = searchParams.get('cnpj')?.trim();
  const nomeParam = searchParams.get('nome')?.trim();

  if (!cnpjParam && !nomeParam) {
    return NextResponse.json(
      { message: 'Query parameter "cnpj" or "nome" is required' },
      { status: 400 }
    );
  }

  const cleanCnpj = cnpjParam ? padCNPJ14(cnpjParam) : null;
  const cleanNome = nomeParam ? normalizarNomeEmpresa(nomeParam) : null;

  try {
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    const data = rows.filter(row => {
      if (cleanCnpj) {
        const rowCnpj = padCNPJ14(row.CNPJ);
        return rowCnpj === cleanCnpj;
      }
      if (cleanNome) {
        const rowNome = normalizarNomeEmpresa(row['Nome da Empresa'] || '');
        return rowNome === cleanNome;
      }
      return false;
    });

    if (data.length === 0) {
      return NextResponse.json({ lastConsultation: null, clienteId: null });
    }

    const mostRecentConsultation = data.reduce((latest, row) => {
      const currentDate = new Date(row.Data_Consulta);
      if (!latest || currentDate > new Date(latest)) {
        return row.Data_Consulta;
      }
      return latest;
    }, '' as string | null);

    const clienteId = data[0]?.Cliente_ID || null;

    return NextResponse.json({ lastConsultation: mostRecentConsultation, clienteId });

  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { message: 'Failed to verify consultation', error: errorMessage },
      { status: 500 }
    );
  }
}
