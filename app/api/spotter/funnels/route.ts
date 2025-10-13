import { NextResponse } from 'next/server';
import { listFunnels } from '@/lib/exactSpotter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const funnels = await listFunnels();
    return NextResponse.json({ value: funnels });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'FUNNELS_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}