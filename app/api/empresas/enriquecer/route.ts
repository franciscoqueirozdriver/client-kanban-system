import { NextResponse } from 'next/server';
import { enrichCompanyData } from '@/lib/perplexity';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, cnpj, hints } = body;

    if (!nome) {
      return NextResponse.json({ message: 'O nome da empresa é obrigatório.' }, { status: 400 });
    }

    const suggestions = await enrichCompanyData({ nome, cnpj }, hints);

    if (Object.keys(suggestions).length === 0) {
        return NextResponse.json({ message: 'Não foi possível encontrar dados para a empresa informada.' }, { status: 404 });
    }

    return NextResponse.json({ suggestion: suggestions });

  } catch (error: any) {
    console.error('[API /empresas/enriquecer]', error);
    // Mascarar a chave da API em mensagens de erro
    const message = error.message.includes('PERPLEXITY_API_KEY')
      ? 'Erro de configuração no servidor.'
      : error.message;

    return NextResponse.json({ message: `Erro ao enriquecer dados: ${message}` }, { status: 500 });
  }
}
