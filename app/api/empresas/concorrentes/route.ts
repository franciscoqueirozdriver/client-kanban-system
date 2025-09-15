import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth/options';
import { findCompetitors } from '@/lib/perplexity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const nome = (body?.nome || '').trim();
    const max  = body?.max ?? 20;
    if (!nome) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 });

    const { items, debug } = await findCompetitors({ nome, max });
    return NextResponse.json({ items, debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao buscar concorrentes' }, { status: 400 });
  }
}
