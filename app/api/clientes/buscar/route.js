import { NextResponse } from 'next/server';
import { getCompanySheetCached, getCompanyHeaderInfoCached, COMPANY_COLUMN_MAP } from '../../../../lib/googleSheets';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').toLowerCase();
  const cnpjQuery = query.replace(/\D/g, ''); // Remove non-digits for CNPJ search

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const [sheet, headerInfo] = await Promise.all([
        getCompanySheetCached(),
        getCompanyHeaderInfoCached()
    ]);

    const rows = sheet.data.values || [];
    const [header, ...dataRows] = rows;

    if (!header) {
      return NextResponse.json([]);
    }

    const { indexMap } = headerInfo;
    const nomeHeader = COMPANY_COLUMN_MAP.Nome_da_Empresa;
    const cnpjHeader = COMPANY_COLUMN_MAP.CNPJ_Empresa;

    const nomeIndex = indexMap[nomeHeader];
    const cnpjIndex = indexMap[cnpjHeader];

    if (nomeIndex === undefined || cnpjIndex === undefined) {
        console.error(`Header columns '${nomeHeader}' or '${cnpjHeader}' not found.`);
        return NextResponse.json({ message: "Sheet is missing required columns." }, { status: 500 });
    }

    const results = dataRows.filter(row => {
      const nome = (row[nomeIndex] || '').toLowerCase();
      const cnpj = (row[cnpjIndex] || '').replace(/\D/g, '');

      if (cnpjQuery.length > 0 && cnpj.includes(cnpjQuery)) {
        return true;
      }

      if (nome.includes(query)) {
        return true;
      }

      return false;
    }).map(row => {
        const companyData = {};
        // Map row array to an object using the header info
        for (const key in COMPANY_COLUMN_MAP) {
            const headerName = COMPANY_COLUMN_MAP[key];
            const headerIndex = indexMap[headerName];
            if (headerIndex !== undefined) {
                companyData[key] = row[headerIndex] || '';
            }
        }
        return companyData;
    });

    // Prioritize exact CNPJ match by moving it to the top
    if (cnpjQuery.length === 14) {
      results.sort((a, b) => {
        const cnpjA = (a.CNPJ_Empresa || '').replace(/\D/g, '');
        const cnpjB = (b.CNPJ_Empresa || '').replace(/\D/g, '');
        if (cnpjA === cnpjQuery) return -1;
        if (cnpjB === cnpjQuery) return 1;
        return 0;
      });
    }


    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching clients:', error);
    return NextResponse.json({ message: 'Error searching clients' }, { status: 500 });
  }
}
