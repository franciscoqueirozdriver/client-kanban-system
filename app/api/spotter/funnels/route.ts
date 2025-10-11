import { NextResponse } from 'next/server';
import { getSpotterToken } from '@/lib/spotter-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = getSpotterToken();
  if (!token) return NextResponse.json({ error: 'SPOTTER_TOKEN missing' }, { status: 500 });

  const r = await fetch('https://api.exactspotter.com/v3/funnels', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', token_exact: token },
    cache: 'no-store',
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return NextResponse.json({ error: 'funnels upstream', details: text }, { status: r.status });
  }

  const json = await r.json();
  const items = Array.isArray(json?.value) ? json.value : [];
  return NextResponse.json(
    items.map((f: any) => ({
      id: String(f.id),
      name: String(f.value ?? ''),
      active: Boolean(f.active),
      position: Number(f.position ?? 0),
    }))
  );
}