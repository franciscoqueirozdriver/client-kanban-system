import { NextResponse } from 'next/server';
import { _findRowNumberBycliente_id, readSheet, updateRowByIndex } from '@/lib/googleSheets';
import { SHEETS as AppSHEETS, SheetName } from '@/lib/sheets-mapping';
import { BaseRow } from '@/types/sheets';
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
        return { sheetName, updated: 0, reason: 'cliente_id não encontrado' };
      }

      const rows = await readSheet<BaseRow>(sheetName);
      const headers = Object.keys(rows[0] || {});
      const updates: Record<string, any> = {};

      if (headers.includes('cnpj_empresa')) updates.cnpj_empresa = cnpjNum;
      if (headers.includes('cnpj_normalizado')) updates.cnpj_normalizado = cnpjNum;
      if (headers.includes('cnpj_matriz')) {
        updates.cnpj_matriz = `${cnpjNum.slice(0, 8)}0001${cnpjNum.slice(-2)}`;
      }
      if (headers.includes('cnpj_raiz')) updates.cnpj_raiz = cnpjNum.slice(0, 8);
      if (headers.includes('is_matriz')) {
        updates.is_matriz = cnpjNum.slice(8, 12) === '0001' ? 'TRUE' : 'FALSE';
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
