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
    }).map(row => {
      // Return all fields from the sheet to be used in the enrichment form
      const companyData: any = {
        _sourceSheet: SHEET_NAME,
        _rowNumber: row._rowNumber
      };
      // Dynamically add all columns from the row to the object
      Object.keys(row).forEach(key => {
        companyData[key] = row[key];
      });
      return companyData;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
