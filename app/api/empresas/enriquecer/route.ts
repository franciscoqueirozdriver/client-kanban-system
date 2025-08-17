import { NextResponse } from 'next/server';
import { enrichCompanyData } from '@/lib/perplexity';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nome = body?.nome ?? '';
    const cnpj = body?.cnpj ?? '';

    const { suggestion, debug } = await enrichCompanyData({ nome, cnpj });

    return NextResponse.json({ suggestion, debug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao enriquecer' }, { status: 400 });
  }
}

