import { NextResponse } from 'next/server';
import { loadSnapshotCard } from '@/lib/perdecomp-persist';
import { getSheetData } from '@/lib/googleSheets';
import { padCNPJ14 } from '@/utils/cnpj';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('clienteId')?.trim();
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!clienteId && !cnpj) {
    return NextResponse.json({ message: 'clienteId or cnpj required' }, { status: 400 });
  }

  // Step 1: try snapshot
  try {
    if (clienteId) {
      const card = await loadSnapshotCard({ clienteId });
      const lastConsultation = card?.header?.requested_at ?? null;
      if (lastConsultation) {
        return NextResponse.json({ lastConsultation });
      }
    }
  } catch (e) {
    console.warn('[verificar] snapshot read failed:', e);
  }

  // Step 2: fallback to PERDECOMP sheet
  try {
    const cleanCnpj = padCNPJ14(cnpj ?? '');
    const { rows } = await getSheetData('PERDECOMP');
    const dataForCnpj = rows.filter(row => {
      const rowCnpj = padCNPJ14(String(row['CNPJ'] || row['cpf_cnpj'] || ''));
      return rowCnpj === cleanCnpj;
    });
    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null });
    }
    const mostRecent = dataForCnpj.reduce((latest, row) => {
      const val = String(row['Data_Consulta'] || row['data_consulta'] || '');
      if (!val) return latest;
      return !latest || new Date(val) > new Date(latest) ? val : latest;
    }, '' as string);
    return NextResponse.json({ lastConsultation: mostRecent || null });
  } catch (e) {
    console.warn('[verificar] PERDECOMP sheet fallback failed:', e);
    return NextResponse.json({ lastConsultation: null });
  }
}
