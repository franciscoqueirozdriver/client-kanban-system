import { NextResponse } from 'next/server';
import { enrichCompanyData } from '@/lib/perplexity';
import { normalizeCNPJ } from '@/src/utils/cnpj';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nome = body?.nome ?? '';
    const cnpj = normalizeCNPJ(body?.cnpj);

    const suggestion = await enrichCompanyData({ nome_da_empresa: nome, cnpj });

    const payload: any = { suggestion };
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao enriquecer' }, { status: 400 });
  }
}

