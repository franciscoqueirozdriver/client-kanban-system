import { NextResponse } from 'next/server';
import { findByCnpj, findByName } from '../../../../lib/googleSheets.js';
import { normalizarNomeEmpresa } from '@/utils/clienteId';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj');
  const nome = searchParams.get('nome');

  if (!cnpj && !nome) {
    return NextResponse.json(
      { error: 'Um CNPJ ou Nome deve ser fornecido para a busca.' },
      { status: 400 }
    );
  }

  try {
    let existingRecord = null;

    // A busca por CNPJ é prioritária e mais confiável
    if (cnpj) {
      existingRecord = await findByCnpj(cnpj);
    }

    // Se não encontrou por CNPJ, tenta pelo nome normalizado
    // A função findByName em googleSheets.js já normaliza o nome da busca
    if (!existingRecord && nome) {
      existingRecord = await findByName(nome);
    }

    if (existingRecord && existingRecord.Cliente_ID) {
      // Retorna um objeto padronizado para o frontend
      return NextResponse.json({
        ok: true,
        empresa: {
          Cliente_ID: existingRecord.Cliente_ID,
          Nome_da_Empresa: existingRecord['Nome da Empresa'] || existingRecord['Nome do Lead'],
          CNPJ_Empresa: existingRecord['CNPJ Empresa'] || existingRecord['CPF/CNPJ'],
        },
      });
    } else {
      return NextResponse.json({ ok: false, message: 'Nenhuma empresa encontrada.' }, { status: 404 });
    }
  } catch (error) {
    console.error('[API /clientes/buscar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
