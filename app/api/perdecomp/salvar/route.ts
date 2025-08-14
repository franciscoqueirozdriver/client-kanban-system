import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/googleSheets';

export async function POST(req: Request) {
  const body = await req.json();
  const linhas: string[][] = body.linhas;
  if (!Array.isArray(linhas) || linhas.some(l => !Array.isArray(l) || l.length !== 18)) {
    return NextResponse.json({ ok: false, message: 'linhas inválidas' }, { status: 400 });
  }
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'PERDECOMP',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: linhas },
    });
    return NextResponse.json({ ok: true, inseridos: linhas.length });
  } catch (err:any) {
    return NextResponse.json({ ok:false, message: err.message || 'Erro' }, { status:500 });
  }
}
