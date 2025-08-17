import { NextResponse } from 'next/server';
import { enrichCompanyData } from '@/lib/perplexity';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, cnpj, hints } = body;
    const wantDebug = process.env.PERPLEXITY_DEBUG === '1' || body?.debug === true;

    if (!nome) {
      return NextResponse.json({ message: 'O nome da empresa é obrigatório.' }, { status: 400 });
    }

    const { suggestion, debug } = await enrichCompanyData({ nome, cnpj }, hints, { debug: wantDebug });

    if (Object.keys(suggestion).length === 0) {
        return NextResponse.json({ message: 'Não foi possível encontrar dados para a empresa informada.' }, { status: 404 });
    }

    if (debug) {
      return NextResponse.json({ suggestion, debug });
    }
    return NextResponse.json({ suggestion });

  } catch (error: any) {
    console.error('[API /empresas/enriquecer]', error);
    // Mascarar a chave da API em mensagens de erro
    const message = error.message.includes('PERPLEXITY_API_KEY')
      ? 'Erro de configuração no servidor.'
      : error.message;

    return NextResponse.json({ message: `Erro ao enriquecer dados: ${message}` }, { status: 500 });
  }
}
