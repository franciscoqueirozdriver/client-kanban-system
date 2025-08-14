// @ts-nocheck
import { NextResponse } from 'next/server';
import { appendRowsToSheet } from '../../../../lib/googleSheets';

export async function POST(req: Request) {
  const { linhas } = await req.json();
  if (!Array.isArray(linhas)) {
    return NextResponse.json({ ok: false, message: 'linhas inválidas' }, { status: 400 });
  }
  if (linhas.some((l) => !Array.isArray(l) || l.length !== 18)) {
    return NextResponse.json({ ok: false, message: 'cada linha deve ter 18 colunas' }, { status: 400 });
  }
  try {
    await appendRowsToSheet('PERDECOMP', linhas);
    return NextResponse.json({ ok: true, inseridos: linhas.length });
  } catch (err) {
    console.error('save error', err);
    return NextResponse.json({ ok: false, message: 'Erro ao salvar' }, { status: 500 });
  }
}
