import { NextResponse } from 'next/server';
import { updateRowByIndex, _findRowNumberByClienteId, getSheetData } from '@/lib/googleSheets';
import { normalizeCnpj } from '@/lib/normalizers';

export const runtime = 'nodejs';

const SHEETS = [
  'Leads Exact Spotter',
  'layout_importacao_empresas',
  'Sheet1',
];

export async function POST(req: Request) {
  try {
    const { clienteId, cnpj } = await req.json();
    if (!clienteId || !cnpj) {
      return NextResponse.json(
        { error: 'clienteId e cnpj são obrigatórios' },
        { status: 400 },
      );
    }

    let cnpjNum;
    try {
      cnpjNum = normalizeCnpj(cnpj);
    } catch (error: any) {
      return NextResponse.json({ error: 'CNPJ inválido', details: error.message }, { status: 400 });
    }

    const results: Array<Record<string, any>> = [];

    const updateSheet = async (sheetName: string) => {
      const rowIndex = await _findRowNumberByClienteId(sheetName, clienteId);
      if (rowIndex === -1) {
        return { sheetName, updated: 0, reason: 'Cliente_ID não encontrado' };
      }

      const { headers } = await getSheetData(sheetName);
      const updates: Record<string, any> = {};

      if (headers.includes('CNPJ_Empresa')) updates.CNPJ_Empresa = cnpjNum;
      if (headers.includes('CNPJ_Normalizado')) updates.CNPJ_Normalizado = cnpjNum;
      if (headers.includes('CNPJ_Matriz')) {
        updates.CNPJ_Matriz = `${cnpjNum.slice(0, 8)}0001${cnpjNum.slice(-2)}`;
      }
      if (headers.includes('CNPJ_Raiz')) updates.CNPJ_Raiz = cnpjNum.slice(0, 8);
      if (headers.includes('Is_Matriz')) {
        updates.Is_Matriz = cnpjNum.slice(8, 12) === '0001' ? 'TRUE' : 'FALSE';
      }

      if (Object.keys(updates).length === 0) {
        return { sheetName, updated: 0, reason: 'Sem colunas de CNPJ nesta aba' };
      }

      await updateRowByIndex({ sheetName, rowIndex, updates });
      return { sheetName, updated: Object.keys(updates).length };
    };

    for (const sheet of SHEETS) {
      try {
        results.push(await updateSheet(sheet));
      } catch (error: any) {
        results.push({
          sheetName: sheet,
          error: error?.message || 'erro ao atualizar',
        });
      }
    }

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao persistir CNPJ' },
      { status: 500 },
    );
  }
}
