import { NextResponse } from 'next/server';
import { appendRow } from '../../../../lib/googleSheets';
import { SHEETS, LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS } from '../../../../lib/sheets-mapping';

function generateClienteId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CL-${datePart}-${randomPart}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body['nome_da_empresa'] || !body['cnpj_empresa']) {
      return NextResponse.json({ ok: false, message: 'Nome da Empresa e CNPJ são obrigatórios.' }, { status: 400 });
    }

    // Generate a new Cliente_ID
    const newId = generateClienteId();
    const newRowObject = { ...body, cliente_id: newId };

    await appendRow(SHEETS.LAYOUT_IMPORTACAO_EMPRESAS, newRowObject);

    return NextResponse.json({ ok: true, message: 'Cliente cadastrado com sucesso!', newClient: newRowObject });
  } catch (error) {
    console.error('[API /clientes/registrar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
