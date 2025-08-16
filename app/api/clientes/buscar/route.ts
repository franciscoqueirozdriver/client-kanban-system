import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/googleSheets.js';

const SHEET_SOURCES = [
  { name: 'layout_importacao_empresas', nameCols: ['Nome da Empresa'], cnpjCol: 'CNPJ Empresa' },
  { name: 'Sheet1', nameCols: ['Organização - Nome', 'Nome da Empresa', 'Cliente'], cnpjCol: null },
  { name: 'Leads Exact Spotter', nameCols: ['Nome da Empresa'], cnpjCol: 'CNPJ' },
];

const findFirstValue = (row: any, cols: string[]): string | null => {
  for (const col of cols) {
    if (row[col]) {
      return row[col];
    }
  }
  return null;
};

const standardizeCompany = (row: any, source: typeof SHEET_SOURCES[0]): any => {
  const companyName = findFirstValue(row, source.nameCols);
  if (!companyName) {
    return null;
  }

  const cnpj = source.cnpjCol ? row[source.cnpjCol] : null;

  return {
    _sourceSheet: source.name, // Add source sheet for update logic
    _rowNumber: row._rowNumber,   // Pass along the row number for updates
    Cliente_ID: row['Cliente_ID'] || `temp-${cnpj || companyName}`,
    Nome_da_Empresa: companyName,
    CNPJ_Empresa: cnpj,
    Site_Empresa: row['Site Empresa'] || row['Site'] || '',
    Pais_Empresa: row['País Empresa'] || row['País'] || '',
    Estado_Empresa: row['Estado Empresa'] || row['UF'] || '',
    Cidade_Empresa: row['Cidade Empresa'] || row['Cidade'] || '',
    Logradouro_Empresa: row['Logradouro Empresa'] || row['Endereço'] || '',
    Numero_Empresa: row['Numero Empresa'] || '',
    Bairro_Empresa: row['Bairro Empresa'] || '',
    Complemento_Empresa: row['Complemento Empresa'] || '',
    CEP_Empresa: row['CEP Empresa'] || row['CEP'] || '',
    DDI_Empresa: row['DDI Empresa'] || '',
    Telefones_Empresa: row['Telefones Empresa'] || row['Telefone'] || '',
    Observacao_Empresa: row['Observação Empresa'] || row['Observação'] || '',
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ message: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    console.log(`[DEBUG] Iniciando busca com query: "${query}"`);
    const normalizedQuery = query.toLowerCase();
    const cnpjQuery = query.replace(/\D/g, '');
    console.log(`[DEBUG] Query normalizada: "${normalizedQuery}", CNPJ Query: "${cnpjQuery}"`);

    const promises = SHEET_SOURCES.map(source => getSheetData(source.name));
    const results = await Promise.allSettled(promises);

    const allCompanies: any[] = [];

    results.forEach((result, index) => {
      const source = SHEET_SOURCES[index];
      console.log(`\n[DEBUG] Processando fonte: ${source.name}`);

      if (result.status === 'fulfilled') {
        const { headers, rows } = result.value;
        console.log(`[DEBUG] ${source.name} - Cabeçalhos:`, headers);
        console.log(`[DEBUG] ${source.name} - Primeiras 2 linhas:`, rows.slice(0, 2));

        const matchingRows = rows.filter(row => {
          if (cnpjQuery && source.cnpjCol && row[source.cnpjCol]?.replace(/\D/g, '') === cnpjQuery) {
            return true;
          }
          return source.nameCols.some(nameCol => row[nameCol]?.toLowerCase().includes(normalizedQuery));
        });

        console.log(`[DEBUG] ${source.name} - Linhas encontradas: ${matchingRows.length}`);

        matchingRows.forEach(row => {
          const company = standardizeCompany(row, source);
          if (company) {
            allCompanies.push(company);
          }
        });
      } else {
        console.error(`[DEBUG] Falha ao ler a fonte ${source.name}:`, result.reason);
      }
    });

    // Deduplicate results
    const uniqueCompanies = new Map();
    allCompanies.forEach(company => {
      const key = company.CNPJ_Empresa?.replace(/\D/g, '') || company.Nome_da_Empresa.toLowerCase();
      if (key && !uniqueCompanies.has(key)) {
        uniqueCompanies.set(key, company);
      }
    });

    console.log(`[DEBUG] Total de empresas únicas encontradas: ${uniqueCompanies.size}`);

    return NextResponse.json(Array.from(uniqueCompanies.values()));
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
