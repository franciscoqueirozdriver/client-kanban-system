import { NextResponse } from 'next/server';
import { _findRowNumberBycliente_id, getSheetData, updateRowByIndex } from '@/lib/googleSheets';
import { SHEETS as AppSHEETS, SheetName } from '@/lib/sheets-mapping';
import { onlyDigits } from '@/utils/cnpj-matriz';

export const runtime = 'nodejs';

const SHEETS_TO_UPDATE: SheetName[] = [
  AppSHEETS.LEADS_EXACT_SPOTTER,
  AppSHEETS.LAYOUT_IMPORTACAO_EMPRESAS,
  AppSHEETS.SHEET1,
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

    const cnpjNum = onlyDigits(String(cnpj));
    if (cnpjNum.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ deve conter 14 dígitos' },
        { status: 400 },
      );
    }

    const results: Array<Record<string, any>> = [];

    const updateSheet = async (sheetName: SheetName) => {
      const rowIndex = await _findRowNumberBycliente_id(sheetName, clienteId);
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

    for (const sheet of SHEETS_TO_UPDATE) {
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
