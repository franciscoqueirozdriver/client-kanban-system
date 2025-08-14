import { NextResponse } from 'next/server';
import { getCompanySheetCached } from '@/lib/googleSheets';

// Helper to remove non-digit characters
const cleanCnpj = (cnpj: string) => cnpj.replace(/\D/g, '');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const sheet = await getCompanySheetCached();
    const rows = sheet.data.values || [];

    if (rows.length < 2) {
      // Not enough data to search (must have header + at least one data row)
      return NextResponse.json([]);
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    const idx = {
      clienteId: header.indexOf('Cliente_ID'),
      nome: header.indexOf('Nome da Empresa'),
      cnpj: header.indexOf('CNPJ Empresa'),
      // Add other fields you want to return
      site: header.indexOf('Site Empresa'),
      pais: header.indexOf('País Empresa'),
      estado: header.indexOf('Estado Empresa'),
      cidade: header.indexOf('Cidade Empresa'),
      logradouro: header.indexOf('Logradouro Empresa'),
      numero: header.indexOf('Numero Empresa'),
      bairro: header.indexOf('Bairro Empresa'),
      complemento: header.indexOf('Complemento Empresa'),
      cep: header.indexOf('CEP Empresa'),
      ddi: header.indexOf('DDI Empresa'),
      telefones: header.indexOf('Telefones Empresa'),
      observacao: header.indexOf('Observação Empresa'),
    };

    // Check if essential columns exist
    if (idx.nome === -1 || idx.cnpj === -1) {
        console.error("Header columns 'Nome da Empresa' or 'CNPJ Empresa' not found.");
        return NextResponse.json({ message: "Sheet format error: required columns not found." }, { status: 500 });
    }

    const cleanedQuery = cleanCnpj(query);

    const results = dataRows
      .map((row) => {
        const nomeEmpresa = row[idx.nome]?.toLowerCase() || '';
        const cnpjEmpresa = cleanCnpj(row[idx.cnpj] || '');

        if (nomeEmpresa.includes(query) || (cleanedQuery && cnpjEmpresa === cleanedQuery)) {
          // Map the row to a structured object
          return {
            Cliente_ID: row[idx.clienteId] || '',
            'Nome da Empresa': row[idx.nome] || '',
            'CNPJ Empresa': row[idx.cnpj] || '',
            'Site Empresa': row[idx.site] || '',
            'País Empresa': row[idx.pais] || '',
            'Estado Empresa': row[idx.estado] || '',
            'Cidade Empresa': row[idx.cidade] || '',
            'Logradouro Empresa': row[idx.logradouro] || '',
            'Numero Empresa': row[idx.numero] || '',
            'Bairro Empresa': row[idx.bairro] || '',
            'Complemento Empresa': row[idx.complemento] || '',
            'CEP Empresa': row[idx.cep] || '',
            'DDI Empresa': row[idx.ddi] || '',
            'Telefones Empresa': row[idx.telefones] || '',
            'Observação Empresa': row[idx.observacao] || '',
          };
        }
        return null;
      })
      .filter(Boolean); // Remove null entries

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching clients:', error);
    return NextResponse.json({ message: 'Error searching clients' }, { status: 500 });
  }
}
