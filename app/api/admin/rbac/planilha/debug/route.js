import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/googleSheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spreadsheet = await getSpreadsheet();
    const titles = spreadsheet.sheets?.map(s => s.properties?.title) || [];
    return NextResponse.json({ ok: true, sheets: titles });
  } catch (error) {
    console.error('Debug route error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch spreadsheet data.', message: error.message },
      { status: 500 }
    );
  }
}
