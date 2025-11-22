import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { onlyDigits } from '@/utils/cnpj';

const SHEET_SNAPSHOT = 'perdecomp_snapshot';
const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCnpj = searchParams.get('cnpj')?.trim();
  const clienteId = searchParams.get('clienteId')?.trim();

  if (!rawCnpj && !clienteId) {
    return NextResponse.json({ message: 'Query parameter "cnpj" or "clienteId" is required' }, { status: 400 });
  }

  // Normalize CNPJ to 14 digits with leading zeros to match sheet format
  const cleanCnpj = rawCnpj ? onlyDigits(rawCnpj).padStart(14, '0') : null;

  try {
    // 1. Check the new snapshot sheet first (Primary Source)
    const snapshotData = await getSheetData(SHEET_SNAPSHOT);
    const snapshotRows = (snapshotData.rows || []) as any[];

    let snapshotMatch: any = null;

    if (clienteId) {
      snapshotMatch = snapshotRows.find(row => row.cliente_id === clienteId);
    }

    if (!snapshotMatch && cleanCnpj) {
      snapshotMatch = snapshotRows.find(row => {
        const rowCnpj = onlyDigits(row.CNPJ).padStart(14, '0');
        return rowCnpj === cleanCnpj;
      });
    }

    if (snapshotMatch && snapshotMatch.Data_Consulta) {
      return NextResponse.json({ lastConsultation: snapshotMatch.Data_Consulta });
    }

    // 2. Check the legacy PERDECOMP sheet (Fallback)
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    let dataForClient = [];

    if (clienteId) {
      dataForClient = rows.filter(row => row.Cliente_ID === clienteId);
    }

    if (dataForClient.length === 0 && cleanCnpj) {
      dataForClient = rows.filter(row => {
        const rowCnpj = onlyDigits(row.CNPJ).padStart(14, '0');
        return rowCnpj === cleanCnpj;
      });
    }

    if (dataForClient.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Find the most recent consultation date in legacy rows
    const mostRecentConsultation = dataForClient.reduce((latest: string | null, row: any) => {
      const currentDate = new Date(row.Data_Consulta);
      if (!latest || currentDate > new Date(latest)) {
        return row.Data_Consulta;
      }
      return latest;
    }, null as string | null);

    return NextResponse.json({ lastConsultation: mostRecentConsultation });

  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to verify consultation', error: errorMessage }, { status: 500 });
  }
}
