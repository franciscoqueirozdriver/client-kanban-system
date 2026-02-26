import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, message: 'Esta rota foi descontinuada. Use /api/infosimples/perdcomp.' },
    { status: 410 }
  );
}
