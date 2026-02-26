import { NextResponse } from 'next/server';
import { loadSnapshotCard } from '@/lib/perdecomp-persist';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('clienteId')?.trim();
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!clienteId && !cnpj) {
    return NextResponse.json({ message: 'Query parameter "clienteId" or "cnpj" is required' }, { status: 400 });
  }

  try {
    // loadSnapshotCard busca por clienteId — se vier só cnpj, retorna null por ora
    const card = clienteId ? await loadSnapshotCard({ clienteId }) : null;
    const lastConsultation = card?.header?.requested_at ?? null;
    return NextResponse.json({ lastConsultation });
  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    return NextResponse.json({ lastConsultation: null });
  }
}
