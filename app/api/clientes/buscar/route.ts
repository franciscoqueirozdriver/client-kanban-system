import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';

const SHEET_NAME = 'Leads Exact Spotter';

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

    const queryWords = normalizedQuery.split(' ').filter(word => word.length > 0);

    const results = rows.filter(row => {
      // Search by CNPJ (exact match on cleaned string)
      if (cnpjQuery && row['CPF/CNPJ']?.replace(/\D/g, '') === cnpjQuery) {
        return true;
      }

      // "AND" search by words in the effective display name
      const displayName = (row['Nome da Empresa'] || row['Nome do Lead'] || '').toLowerCase();
      const allWordsMatch = queryWords.every(word => displayName.includes(word));
      if (allWordsMatch) {
        return true;
      }

      return false;
    }).map(row => ({
      // Map to the format expected by the frontend
      Cliente_ID: row['Cliente_ID'],
      Nome_da_Empresa: row['Nome da Empresa'] || row['Nome do Lead'],
      CNPJ_Empresa: row['CPF/CNPJ'],
      // Include other fields from the sheet as needed by the frontend form
      Site_Empresa: row['Site'],
      Pais_Empresa: row['País'],
      Estado_Empresa: row['Estado'],
      Cidade_Empresa: row['Cidade'],
      Logradouro_Empresa: row['Logradouro'],
      Numero_Empresa: row['Número'],
      Bairro_Empresa: row['Bairro'],
      Complemento_Empresa: row['Complemento'],
      CEP_Empresa: row['CEP'],
      DDI_Empresa: row['DDI'],
      Telefones_Empresa: row['Telefones'],
      Observacao_Empresa: row['Observação'],
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
