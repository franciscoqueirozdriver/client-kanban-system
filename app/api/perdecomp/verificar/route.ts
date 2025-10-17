import { NextResponse } from 'next/server';
import { SHEET_SNAPSHOT, getSheetData, normalizeCNPJ } from '@/lib/perdecomp-persist';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.trim() || null;
  const clienteId = searchParams.get('clienteId')?.trim() || null;

  console.info('PERDECOMP_VERIFY_SNAPSHOT', { by: clienteId ? 'clienteId' : cnpj ? 'cnpj' : 'none' });

  if (!clienteId && !cnpj) {
    return NextResponse.json(
      { message: 'Query parameter "clienteId" or "cnpj" is required' },
      { status: 400 },
    );
  }

  try {
    const { rows } = await getSheetData(SHEET_SNAPSHOT);

    let match: Record<string, any> | undefined;

    if (clienteId) {
      match = rows.find((row: Record<string, any>) => row.Cliente_ID === clienteId);
    }

    if (!match && cnpj) {
      const clean = normalizeCNPJ(cnpj);
      match = rows.find((row: Record<string, any>) => normalizeCNPJ(row.CNPJ) === clean);
    }

    const lastConsultation = match?.Last_Updated_ISO || match?.Data_Consulta || null;

    console.info('PERDECOMP_VERIFY_SNAPSHOT_OK', { lastConsultation, hit: !!match });

    return NextResponse.json({ lastConsultation });
  } catch (err) {
    console.error('PERDECOMP_VERIFY_SNAPSHOT_FAIL', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ message: 'Failed to verify consultation' }, { status: 500 });
  }
}
