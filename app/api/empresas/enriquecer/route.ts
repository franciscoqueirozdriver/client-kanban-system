import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { enrichCompanyData } from '@/lib/perplexity';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const nome = body?.nome ?? '';
    const cnpj = body?.cnpj ?? '';

    const { suggestion, debug } = await enrichCompanyData({ nome, cnpj });

    const payload: any = { suggestion };
    if (debug) payload.debug = debug;
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao enriquecer' }, { status: 400 });
  }
}

