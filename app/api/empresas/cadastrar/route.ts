import { NextResponse } from 'next/server';
import {
  getNextClienteId,
  findByCnpj,
  findByName,
  appendToSheets,
} from '../../../../lib/googleSheets';

// --- Helper Functions ---

/**
 * Normalizes a CNPJ string to 14 digits.
 * @param cnpj The CNPJ string.
 * @returns The normalized CNPJ or an empty string.
 */
function normalizeCnpj(cnpj: string | undefined | null): string {
  return String(cnpj || '').replace(/\D/g, '');
}

/**
 * Validates a Brazilian CNPJ.
 * @param cnpj The CNPJ string (can be formatted or just digits).
 * @returns True if the CNPJ is valid, false otherwise.
 */
function isValidCnpj(cnpj: string | undefined | null): boolean {
  const digits = normalizeCnpj(cnpj);

  if (digits.length !== 14) return false;

  // Check for known invalid CNPJs (e.g., '000...000')
  if (/^(\d)\1+$/.test(digits)) return false;

  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const checkDigits = digits.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(checkDigits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(checkDigits.charAt(1), 10)) return false;

  return true;
}

// --- API Route Handler ---

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { Nome_da_Empresa, CNPJ_Empresa, ...rest } = payload;

    // 1. Validation
    if (!Nome_da_Empresa) {
      return NextResponse.json({ message: 'O "Nome da Empresa" é obrigatório.' }, { status: 400 });
    }

    const normalizedCnpj = normalizeCnpj(CNPJ_Empresa);
    if (normalizedCnpj && !isValidCnpj(normalizedCnpj)) {
      return NextResponse.json({ message: 'O CNPJ informado é inválido.' }, { status: 400 });
    }

    // 2. Duplicate & Enrichment Check
    if (normalizedCnpj) {
      const existingByCnpj = await findByCnpj(normalizedCnpj);
      if (existingByCnpj) {
        return NextResponse.json(
          {
            message: `Empresa já cadastrada na planilha '${existingByCnpj._sheetName}' com este CNPJ.`,
            suggestion: 'enrich',
            company: existingByCnpj,
          },
          { status: 409 }
        );
      }
    }

    const existingByName = await findByName(Nome_da_Empresa);
    // If a record with the same name exists AND it has no CNPJ, suggest enriching it.
    if (existingByName && !normalizeCnpj(existingByName['CNPJ Empresa'])) {
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
    const clienteId = await getNextClienteId();

    // 4. Prepare final payload
    const finalPayload = {
      Cliente_ID: clienteId,
      Nome_da_Empresa,
      CNPJ_Empresa: normalizedCnpj, // Save the normalized CNPJ
      ...rest,
    };

    // 5. Write to Sheets
    await appendToSheets(finalPayload);

    // 6. Return Success
    return NextResponse.json({ ok: true, company: finalPayload }, { status: 201 });

  } catch (error: any) {
    console.error('[API /empresas/cadastrar]', error);
    return NextResponse.json({ message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}
