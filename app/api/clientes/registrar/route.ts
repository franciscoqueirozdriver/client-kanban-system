import { NextResponse } from 'next/server';
import { appendSheetData } from '../../../../lib/googleSheets.js';

const SHEET_NAME = 'layout_importacao_empresas';

const HEADERS = [
  'cliente_id', 'nome_da_empresa', 'site_empresa', 'pais_empresa', 'estado_empresa',
  'cidade_empresa', 'logradouro_empresa', 'numero_empresa', 'bairro_empresa',
  'complemento_empresa', 'cep_empresa', 'cnpj_empresa', 'ddi_empresa',
  'telefones_empresa', 'observacao_empresa'
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

    if (!body['nome_da_empresa'] || !body['cnpj_empresa']) {
      return NextResponse.json({ ok: false, message: 'Nome da Empresa e CNPJ são obrigatórios.' }, { status: 400 });
    }

    const newId = generateClienteId();
    const newRowObject = { ...body, cliente_id: newId };

    const rowToAppend = HEADERS.map(header => newRowObject[header] ?? '');

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID não configurado no ambiente.');
    }

    await appendSheetData({
      spreadsheetId,
      range: SHEET_NAME,
      values: [rowToAppend],
    });

    return NextResponse.json({ ok: true, message: 'Cliente cadastrado com sucesso!', newClient: newRowObject });
  } catch (error) {
    console.error('[API /clientes/registrar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
