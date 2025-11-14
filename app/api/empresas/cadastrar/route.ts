import { NextResponse } from 'next/server';
import {
  getNextcliente_id,
  findByCnpj,
  findByName,
  appendToSheets,
  updateInSheets,
} from '@/lib/googleSheets';

// --- Helper Functions ---

function normalizeCnpj(cnpj: string | undefined | null): string {
  return String(cnpj || '').replace(/\D/g, '');
}

function isValidCnpj(cnpj: string | undefined | null): boolean {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  // Calculation logic remains the same...
  let size = 12, sum = 0, pos = 5;
  for (let i = 0; i < size; i++) {
    sum += parseInt(digits[i]) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits[12])) return false;
  size = 13; sum = 0; pos = 6;
  for (let i = 0; i < size; i++) {
    sum += parseInt(digits[i]) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits[13]);
}

// --- API Route Handler ---

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { Cliente_ID, Empresa, Contato, Comercial } = payload;

    // 1. Validation
    if (!Empresa?.Nome_da_Empresa) {
      return NextResponse.json({ message: 'O "Nome da Empresa" é obrigatório.' }, { status: 400 });
    }

    const normalizedCnpj = normalizeCnpj(Empresa.CNPJ_Empresa);
    if (Empresa.CNPJ_Empresa && !isValidCnpj(normalizedCnpj)) {
      return NextResponse.json({ message: 'O CNPJ informado é inválido.' }, { status: 400 });
    }

    // --- UPDATE FLOW ---
    if (Cliente_ID) {
      // In update mode, we assume the user has confirmed and we just save the data.
      // A more robust check could re-verify the CNPJ isn't being changed to a conflicting one, but we'll keep it simple.
      await updateInSheets(payload, Cliente_ID);
      const savedCompany = {
          cliente_id: Cliente_ID,
          nome_da_empresa: Empresa.Nome_da_Empresa,
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
    if (existingByName && !normalizeCnpj(String(existingByName['CNPJ Empresa'] || ''))) {
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
    const newClienteId = await getNextcliente_id();
    const finalPayload = { ...payload, cliente_id: newClienteId };

    // 4. Write to Sheets
    await appendToSheets(finalPayload);

    // 5. Return Success
    const savedCompany = {
        cliente_id: newClienteId,
        nome_da_empresa: Empresa.Nome_da_Empresa,
        cnpj_empresa: normalizedCnpj,
    };
    return NextResponse.json({ ok: true, company: savedCompany }, { status: 201 });

  } catch (error: any) {
    console.error('[API /empresas/cadastrar]', error);
    return NextResponse.json({ message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}
