import { NextResponse } from 'next/server';
import { appendSheetData } from '../../../../lib/googleSheets.js';

const SHEET_NAME = 'layout_importacao_empresas';

const HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Site Empresa', 'País Empresa',
  'Estado Empresa', 'Cidade Empresa', 'Logradouro Empresa', 'Numero Empresa',
  'Bairro Empresa', 'Complemento Empresa', 'CEP Empresa', 'CNPJ Empresa',
  'DDI Empresa', 'Telefones Empresa', 'Observação Empresa'
];

export async function POST(request: Request) {
  try {
    const newCompany = await request.json();

    if (!newCompany || !newCompany['Nome da Empresa'] || !newCompany['CNPJ Empresa']) {
      return NextResponse.json({ message: 'Dados da empresa incompletos.' }, { status: 400 });
    }

    // Ensure Client_ID is generated if not provided
    if (!newCompany['Cliente_ID']) {
      const timestamp = new Date().getTime();
      newCompany['Cliente_ID'] = `C${timestamp}`;
    }

    const newRow = HEADERS.map(header => newCompany[header] || '');

    await appendSheetData(SHEET_NAME, [newRow]);

    return NextResponse.json({ ok: true, message: 'Empresa salva com sucesso!', data: newCompany });
  } catch (error) {
    console.error('[API /clientes/salvar]', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
