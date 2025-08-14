import { NextResponse } from 'next/server';
import { appendPerdecompRows, PERDECOMP_COLUMN_MAP } from '../../../../lib/googleSheets';

export async function POST(request) {
    const { linhas } = await request.json();

    if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
        return NextResponse.json({ ok: false, message: 'Invalid input: "linhas" must be a non-empty array.' }, { status: 400 });
    }

    const expectedKeys = Object.keys(PERDECOMP_COLUMN_MAP);

    // Basic validation on the first row to ensure it looks like a PER/DCOMP record
    const firstRow = linhas[0];
    if (typeof firstRow !== 'object' || firstRow === null || !expectedKeys.some(key => Object.prototype.hasOwnProperty.call(firstRow, key))) {
        return NextResponse.json({ ok: false, message: 'Invalid input: "linhas" items must be objects with valid keys.' }, { status: 400 });
    }

    try {
        const result = await appendPerdecompRows(linhas);
        const insertedCount = result.data?.updates?.updatedRows || 0;
        return NextResponse.json({ ok: true, inseridos: insertedCount });
    } catch (error) {
        console.error('Error saving PERDCOMP data to Google Sheets:', error);
        return NextResponse.json({ ok: false, message: 'Failed to save data to spreadsheet.' }, { status: 500 });
    }
}
