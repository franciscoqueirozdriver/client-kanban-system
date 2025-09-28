import { NextResponse } from 'next/server';
import { appendSheetData } from '@/lib/googleSheets';
import { getSheetData } from '@/lib/googleSheets';

const SHEET_NAME = 'layout_importacao_empresas';

const HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Site Empresa', 'País Empresa', 'Estado Empresa',
  'Cidade Empresa', 'Logradouro Empresa', 'Numero Empresa', 'Bairro Empresa',
  'Complemento Empresa', 'CEP Empresa', 'CNPJ Empresa', 'DDI Empresa',
  'Telefones Empresa', 'Observação Empresa'
];

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
    if (!body['Nome da Empresa'] || !body['CNPJ Empresa']) {
      return NextResponse.json({ ok: false, message: 'Nome da Empresa e CNPJ são obrigatórios.' }, { status: 400 });
    }

    // Generate a new Cliente_ID
    const newId = generateClienteId();
    const newRowObject = { ...body, Cliente_ID: newId };

    // Ensure the row has all headers in the correct order
    const rowToAppend = HEADERS.map(header => newRowObject[header] ?? '');

    await appendSheetData(SHEET_NAME, [rowToAppend]);

    return NextResponse.json({ ok: true, message: 'Cliente cadastrado com sucesso!', newClient: newRowObject });
  } catch (error) {
    console.error('[API /clientes/registrar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
