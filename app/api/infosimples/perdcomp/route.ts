import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return new NextResponse(
    JSON.stringify({ error: 'Endpoint /api/infosimples/perdcomp descontinuado. Use /api/sheets/cnpj.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
