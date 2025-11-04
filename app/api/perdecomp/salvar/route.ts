import { NextResponse } from 'next/server';
import { appendSheetData } from '../../../../lib/googleSheets.js';
import { getColumnMapping, getOriginalColumnName } from '../../../../lib/sheets-mapping';

const PERDECOMP_SHEET_NAME = 'perdecomp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { linhas } = body;

    if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ ok: false, message: 'Payload inválido: "linhas" deve ser um array não-vazio.' }, { status: 400 });
    }

    const columnMapping = getColumnMapping(PERDECOMP_SHEET_NAME);
    const originalHeaders = Object.keys(columnMapping);

    const rowsToAppend = linhas.map((linha: any) => {
      return originalHeaders.map(header => {
        const snakeCaseKey = (columnMapping as Record<string, string>)[header];
        return linha[snakeCaseKey] ?? '';
      });
    });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID não configurado no ambiente.');
    }

    await appendSheetData({
      spreadsheetId,
      range: PERDECOMP_SHEET_NAME,
      values: rowsToAppend,
    });

    return NextResponse.json({ ok: true, inseridos: rowsToAppend.length });
  } catch (error) {
    console.error('[API /perdecomp/salvar]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
