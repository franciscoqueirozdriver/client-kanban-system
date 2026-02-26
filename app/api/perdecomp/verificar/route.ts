import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';
import { padCNPJ14 } from '@/utils/cnpj';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';
const SNAPSHOT_SHEET_NAME = 'perdecomp_snapshot';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!cnpj) {
    return NextResponse.json({ message: 'Query parameter "cnpj" is required' }, { status: 400 });
  }

  const cleanCnpj = padCNPJ14(cnpj);

  try {
    // Diagnóstico temporário conforme solicitado
    const snapshotRes = await getSheetData(SNAPSHOT_SHEET_NAME);
    const snapshotRows = snapshotRes.rows;

    const dataForCnpjSnapshot = snapshotRows.filter(row => {
      const rowCnpj = padCNPJ14(String(row.cnpj || row.CNPJ || row.cnpj_empresa || row.CNPJ_Empresa || ''));
      return rowCnpj === cleanCnpj;
    });

    console.log('[verificar] total rows snapshot:', snapshotRows.length);
    console.log('[verificar] sample keys snapshot:', snapshotRows[0] ? Object.keys(snapshotRows[0]) : 'empty');
    console.log('[verificar] rows for cnpj snapshot:', dataForCnpjSnapshot.length);

    if (dataForCnpjSnapshot.length > 0) {
        const mostRecentSnapshot = dataForCnpjSnapshot.reduce((latest, row) => {
          const currentDateStr = String(
            row.data_consulta ||
            row.Data_Consulta ||
            row.requested_at ||
            row.data_consulta_str ||
            ''
          );
          if (!currentDateStr) return latest;
          const currentDate = new Date(currentDateStr);
          if (!latest || currentDate > new Date(latest)) {
            return currentDateStr;
          }
          return latest;
        }, '' as string | null);

        if (mostRecentSnapshot) {
            return NextResponse.json({ lastConsultation: mostRecentSnapshot });
        }
    }

    // Fallback para a planilha legada PERDECOMP
    const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

    const dataForCnpj = rows.filter(row => {
      const rowCnpj = padCNPJ14(String(row.cnpj || row.CNPJ || row.cnpj_empresa || row.CNPJ_Empresa || ''));
      return rowCnpj === cleanCnpj;
    });

    console.log('[verificar] total rows legacy:', rows.length);
    console.log('[verificar] sample keys legacy:', rows[0] ? Object.keys(rows[0]) : 'empty');
    console.log('[verificar] rows for cnpj legacy:', dataForCnpj.length);

    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }

    // Find the most recent consultation date with requested fallbacks
    const mostRecentConsultation = dataForCnpj.reduce((latest, row) => {
      const currentDateStr = String(
        row.data_consulta ||
        row.Data_Consulta ||
        row.requested_at ||
        row.data_consulta_str ||
        ''
      );
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
