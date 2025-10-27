import { NextResponse } from 'next/server';
import {
  getNextClienteId,
  findByCnpj,
  findByName,
  appendToSheets,
  updateInSheets,
  getSheetName,
} from '../../../../lib/googleSheets';
import { normalizeCNPJ, isValidCNPJ } from '@/src/utils/cnpj';

// Usar nomes de abas normalizados
const SHEET_NAME = getSheetName('Sheet1');
const COMPANY_IMPORT_SHEET_NAME = getSheetName('layout_importacao_empresas');

// --- API Route Handler ---

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { Cliente_ID, Empresa, Contato, Comercial } = payload;

    // 1. Validation
    if (!Empresa?.Nome_da_Empresa) {
      return NextResponse.json({ message: 'O "Nome da Empresa" é obrigatório.' }, { status: 400 });
    }

    const normalizedCnpj = normalizeCNPJ(Empresa.CNPJ_Empresa);
    if (Empresa.CNPJ_Empresa && !isValidCNPJ(normalizedCnpj)) {
      return NextResponse.json({ message: 'O CNPJ informado é inválido.' }, { status: 400 });
    }

    // --- UPDATE FLOW ---
    if (Cliente_ID) {
      // In update mode, we assume the user has confirmed and we just save the data.
      // A more robust check could re-verify the CNPJ isn't being changed to a conflicting one, but we'll keep it simple.
      await updateInSheets(Cliente_ID, payload);
      const savedCompany = {
          Cliente_ID,
          Nome_da_Empresa: Empresa.Nome_da_Empresa,
          CNPJ_Empresa: normalizedCnpj,
      };
      return NextResponse.json({ ok: true, company: savedCompany }, { status: 200 });
    }

    // --- CREATE FLOW ---

    // 2. Duplicate & Enrichment Check
    if (normalizedCnpj) {
      const existingByCnpj = await findByCnpj(normalizedCnpj);
      if (existingByCnpj) {
        return NextResponse.json(
          { message: `Empresa já cadastrada com este CNPJ.`, company: existingByCnpj },
          { status: 409 }
        );
      }
    }

    const existingByName = await findByName(Empresa.Nome_da_Empresa);
    if (existingByName && !normalizeCNPJ(existingByName['CNPJ Empresa'])) {
       return NextResponse.json(
        {
            message: 'Encontramos uma empresa com este nome mas sem CNPJ. Deseja enriquecer o cadastro existente?',
            mode: 'enrich-existing',
            company: existingByName
        },
        { status: 200 }
      );
    }

    // 3. Generate New ID
    const newClienteId = await getNextClienteId();
    const finalPayload = { ...payload, Cliente_ID: newClienteId };

    // 4. Write to Sheets
    await appendToSheets(finalPayload);

    // 5. Return Success
    const savedCompany = {
        Cliente_ID: newClienteId,
        Nome_da_Empresa: Empresa.Nome_da_Empresa,
        CNPJ_Empresa: normalizedCnpj,
    };
    return NextResponse.json({ ok: true, company: savedCompany }, { status: 201 });

  } catch (error: any) {
    console.error('[API /empresas/cadastrar]', error);
    return NextResponse.json({ message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}
