import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';

const SHEET_NAME = 'layout_importacao_empresas';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ message: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const { rows } = await getSheetData(SHEET_NAME);

    const normalizedQuery = query.toLowerCase();
    const cnpjQuery = query.replace(/\D/g, '');

    const results = rows.filter(row => {
      if (cnpjQuery && row['CNPJ Empresa']?.replace(/\D/g, '') === cnpjQuery) {
        return true;
      }
      if (row['Nome da Empresa']?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
      return false;
    }).map(row => ({
      // Return only the necessary fields for the autocomplete
      Cliente_ID: row['Cliente_ID'],
      Nome_da_Empresa: row['Nome da Empresa'],
      CNPJ_Empresa: row['CNPJ Empresa'],
      // Include other fields from the sheet as needed by the frontend form
      Site_Empresa: row['Site Empresa'],
      Pais_Empresa: row['País Empresa'],
      Estado_Empresa: row['Estado Empresa'],
      Cidade_Empresa: row['Cidade Empresa'],
      Logradouro_Empresa: row['Logradouro Empresa'],
      Numero_Empresa: row['Numero Empresa'],
      Bairro_Empresa: row['Bairro Empresa'],
      Complemento_Empresa: row['Complemento Empresa'],
      CEP_Empresa: row['CEP Empresa'],
      DDI_Empresa: row['DDI Empresa'],
      Telefones_Empresa: row['Telefones Empresa'],
      Observacao_Empresa: row['Observação Empresa'],
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
