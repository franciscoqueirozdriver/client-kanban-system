import { NextResponse } from 'next/server';
import { listStages } from '@/lib/exactSpotter';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const funnelId = Number(url.searchParams.get('funnelId') ?? '');
    const stages = await listStages();
    const value = Number.isFinite(funnelId)
      ? stages.filter(s => s.funnelId === funnelId)
      : stages;
    return NextResponse.json({ value });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'STAGES_ERROR' }, { status: 500 });
  }
}