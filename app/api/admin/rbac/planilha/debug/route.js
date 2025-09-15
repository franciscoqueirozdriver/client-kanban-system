import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth/options';
import { getSpreadsheet } from '@/lib/googleSheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
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
