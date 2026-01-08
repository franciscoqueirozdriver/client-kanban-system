import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { onlyDigits } from '@/utils/cnpj';

const SHEET_SNAPSHOT = 'perdecomp_snapshot';
const PERDECOMP_SHEET_NAME = 'PERDECOMP';

export const runtime = 'nodejs';

function getClienteIdFromRow(row: any): string {
  return String(row.cliente_id ?? row.Cliente_ID ?? row['Cliente ID'] ?? '').trim();
}

function getCnpjFromRow(row: any): string {
  const raw = row.cnpj ?? row.CNPJ ?? row['CNPJ Empresa'] ?? row.cnpj_normalizado ?? '';
  // We want strict 14-digit comparison if possible, but sheet might have 12
  return onlyDigits(String(raw));
}

function getDataConsultaFromRow(row: any): string | null {
  return (
    (row.Data_Consulta as string | undefined) ??
    (row.data_consulta as string | undefined) ??
    (row['Data Consulta'] as string | undefined) ??
    null
  );
}

function findLatestDate(rows: any[], clienteId: string | null, cleanCnpj: string | null): string | null {
  const candidates = rows.filter(row => {
    const rowClienteId = getClienteIdFromRow(row);
    const rowCnpjRaw = getCnpjFromRow(row);

    if (clienteId && rowClienteId === clienteId) {
      return true;
    }

    if (cleanCnpj) {
      // Strict match (padded)
      const rowCnpjPadded = rowCnpjRaw.padStart(14, '0');
      if (rowCnpjPadded === cleanCnpj) return true;

      // Partial match (Sheet has 12 digits - root+branch)
      // Input: 10490181000135, Sheet: 104901810001
      if (rowCnpjRaw.length === 12 && cleanCnpj.startsWith(rowCnpjRaw)) {
        return true;
      }
    }
    return false;
  });

  return candidates.reduce<string | null>((latest, row) => {
    const dt = getDataConsultaFromRow(row);
    if (!dt) return latest;
    // Simple string comparison for ISO/YYYY-MM-DD, but Date parsing is safer
    const current = new Date(dt);
    if (isNaN(current.getTime())) return latest;

    if (!latest) return dt;
    return current > new Date(latest) ? dt : latest;
  }, null);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCnpj = searchParams.get('cnpj')?.trim();
  const clienteId = searchParams.get('clienteId')?.trim() || null;

  if (!rawCnpj && !clienteId) {
    return NextResponse.json({ message: 'Query parameter "cnpj" or "clienteId" is required' }, { status: 400 });
  }

  const cleanCnpj = rawCnpj ? onlyDigits(rawCnpj).padStart(14, '0') : null;

  try {
    // 1. Check the new snapshot sheet first (Primary Source)
    const snapshotData = await getSheetData(SHEET_SNAPSHOT);
    const snapshotRows = (snapshotData.rows || []) as any[];

    const latestSnapshot = findLatestDate(snapshotRows, clienteId, cleanCnpj);
    if (latestSnapshot) {
      return NextResponse.json({ lastConsultation: latestSnapshot });
    }

    // 2. Check the legacy PERDECOMP sheet (Fallback)
    const { rows: legacyRows } = await getSheetData(PERDECOMP_SHEET_NAME);
    const latestLegacy = findLatestDate(legacyRows, clienteId, cleanCnpj);

    return NextResponse.json({ lastConsultation: latestLegacy });

  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to verify consultation', error: errorMessage }, { status: 500 });
  }
}
