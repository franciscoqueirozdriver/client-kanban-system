import { NextResponse } from 'next/server';

const BASE = process.env.EXACT_SPOTTER_BASE_URL || 'https://api.exactspotter.com/v3';
const TOKEN = process.env.EXACT_SPOTTER_TOKEN || '';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const funnelId = searchParams.get('funnelId')?.trim();

    const normalizedBase = BASE.replace(/\/+$/, '');
    const url = funnelId
      ? `${normalizedBase}/stages?$filter=funnelId eq ${encodeURIComponent(funnelId)}`
      : `${normalizedBase}/stages`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        token_exact: TOKEN,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ value: [] }, { status: 200 });
    }

    const data = await res.json();
    const raw: any[] = Array.isArray(data?.value) ? data.value : [];

    const value = raw
      .filter((stage) => (!funnelId || String(stage?.funnelId) === String(funnelId)))
      .map((stage) => ({
        id: String(stage?.id ?? ''),
        value: String(stage?.value ?? ''),
        funnelId: String(stage?.funnelId ?? ''),
        active: Boolean(stage?.active),
        position: Number(stage?.position ?? 0),
        gateType: stage?.gateType ?? null,
      }));

    return NextResponse.json({ value }, { status: 200 });
  } catch {
    return NextResponse.json({ value: [] }, { status: 200 });
  }
}
