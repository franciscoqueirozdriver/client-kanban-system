// app/api/spoter/oportunidades/route.js
import { NextResponse } from 'next/server';
import { createOportunidadeSpotter, normalizaTelefoneBR } from '@/lib/exactSpotter';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      titulo,
      empresa,
      contato_nome,
      contato_email,
      contato_telefone,
      origem,
      valor_previsto,
      observacoes
    } = body || {};

    if (!titulo || !empresa) {
      return NextResponse.json({ error: 'titulo e empresa são obrigatórios' }, { status: 400 });
    }

    // Defaults
    const emailDefault = process.env.DEFAULT_CONTACT_EMAIL || null;
    const origemDefault = process.env.DEFAULT_CONTACT_ORIGEM || null;

    const telIntl = contato_telefone ? normalizaTelefoneBR(contato_telefone) : null;

    // MAPEAMENTO → ajuste após validar no $metadata do seu tenant:
    const payloadSpotter = {
      Titulo: titulo,
      Empresa: empresa,
      ContatoNome: contato_nome || null,
      ContatoEmail: contato_email || emailDefault,
      ContatoTelefone: telIntl,
      Origem: origem || origemDefault,
      ValorPrevisto: typeof valor_previsto === 'number' ? valor_previsto : null,
      Observacoes: observacoes || null
    };

    const created = await createOportunidadeSpotter(payloadSpotter, {
      entitySetPath: '/Oportunidades' // ajustar pelo $metadata
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
