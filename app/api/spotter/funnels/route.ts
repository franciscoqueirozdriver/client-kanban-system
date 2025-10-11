import { NextResponse } from 'next/server';
import { listFunnels } from '@/lib/exactSpotter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const funnels = await listFunnels();
    return NextResponse.json({ value: funnels });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'FUNNELS_ERROR' }, { status: 500 });
  }
}