import { NextResponse } from 'next/server';
import { appendPerdecompRows } from '@/lib/googleSheets';

const REQUIRED_COLUMN_COUNT = 18;

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { linhas } = body;

  if (!Array.isArray(linhas)) {
    return NextResponse.json({ ok: false, message: 'Request body must contain a "linhas" array.' }, { status: 400 });
  }

  if (linhas.length === 0) {
    return NextResponse.json({ ok: true, inseridos: 0, message: 'No rows to insert.' });
  }

  // Validate that every row has the correct number of columns
  for (const linha of linhas) {
    if (!Array.isArray(linha) || linha.length !== REQUIRED_COLUMN_COUNT) {
      return NextResponse.json({
        ok: false,
        message: `Invalid row format. Each row must be an array with exactly ${REQUIRED_COLUMN_COUNT} columns.`,
        offendingRow: linha,
      }, { status: 400 });
    }
  }

  try {
    const result = await appendPerdecompRows(linhas);
    const updatedRange = result.data.updates?.updatedRange || '';
    const insertedCount = updatedRange.match(/:/g) ? (updatedRange.split('!')[1].split(':')[1].match(/\d+/g) || ['0'])[0] - (updatedRange.split('!')[1].split(':')[0].match(/\d+/g) || ['0'])[0] + 1 : linhas.length;


    return NextResponse.json({ ok: true, inseridos: insertedCount });
  } catch (error) {
    console.error('Error saving to PERDECOMP sheet:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while saving to the spreadsheet.';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
