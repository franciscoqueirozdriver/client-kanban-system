import { NextResponse } from 'next/server';
import { appendCompanyImportRow, getCompanySheetCached } from '@/lib/googleSheets';

const cleanCnpj = (cnpj: string = '') => cnpj.replace(/\D/g, '');

export async function POST(request: Request) {
    let companyData;
    try {
        companyData = await request.json();
    } catch (error) {
        return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
    }

    // Basic validation
    if (!companyData || !companyData.nome) {
        return NextResponse.json({ ok: false, message: 'Company data must include a name ("nome").' }, { status: 400 });
    }

    const { cnpj, nome } = companyData;

    // Check for duplicates before saving
    try {
        const sheet = await getCompanySheetCached();
        const rows = sheet.data.values || [];
        const [header, ...dataRows] = rows;
        const idx = {
          cnpj: header.indexOf('CNPJ Empresa'),
          nome: header.indexOf('Nome da Empresa'),
        };

        const duplicate = dataRows.some((row) => {
          const cnpjVal = cleanCnpj(row[idx.cnpj] || '');
          const nomeVal = row[idx.nome] || '';
          return (
            (cnpj && cnpjVal === cleanCnpj(cnpj)) ||
            (nome && nomeVal && nomeVal.toLowerCase() === nome.toLowerCase())
          );
        });

        if (duplicate) {
          return NextResponse.json({ ok: false, message: 'Já existe uma empresa com este Nome ou CNPJ.' }, { status: 409 });
        }
    } catch (err) {
        console.error('Erro ao verificar duplicidade:', err);
        // Decide if you want to block saving or not. For now, we'll proceed.
    }

    try {
        // The data received should already be in the format expected by appendCompanyImportRow's mapping.
        // e.g., { nome: '...', site: '...' }
        const result = await appendCompanyImportRow(companyData);
        return NextResponse.json({ ok: true, data: result.data });
    } catch (error) {
        console.error('Error saving new client:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while saving the client.';
        return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
    }
}
