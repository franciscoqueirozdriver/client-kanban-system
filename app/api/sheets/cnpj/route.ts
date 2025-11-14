import { NextResponse } from 'next/server';
import { updateRowByIndex, _findRowNumberBycliente_id, getSheetData } from '@/lib/googleSheets';
import { onlyDigits } from '@/utils/cnpj';
import { SHEETS, SheetName } from '@/lib/sheets-mapping';

export const runtime = 'nodejs';

const SHEETS_TO_UPDATE: SheetName[] = [
  SHEETS.LEADS_EXACT_SPOTTER,
  SHEETS.LAYOUT_IMPORTACAO_EMPRESAS,
  SHEETS.SHEET1,
];

export async function POST(req: Request) {
  try {
    const { clienteId, cnpj } = await req.json();
    const results: any[] = [];

    for (const sheetName of SHEETS_TO_UPDATE) {
      const rowNumber = await _findRowNumberBycliente_id(sheetName, clienteId);

      if (rowNumber !== -1) {
        await updateRowByIndex({ sheetName, rowIndex: rowNumber, updates: { 'cnpj': onlyDigits(cnpj) } });
        results.push({ sheet: sheetName, status: 'updated' });
      } else {
        results.push({ sheet: sheetName, status: 'cliente_id_not_found' });
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
