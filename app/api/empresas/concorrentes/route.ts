import { NextResponse } from 'next/server';
import { findCompetitors } from '@/lib/perplexity';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nome = (body?.nome || '').trim();
    const max  = body?.max ?? 20;
    if (!nome) return NextResponse.json({ items: [] }, { status: 200 });

    const { items, debug } = await findCompetitors({ nome, max });
    return NextResponse.json({ items: Array.isArray(items) ? items : [], debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'Erro ao buscar concorrentes' }, { status: 200 });
  }
}
