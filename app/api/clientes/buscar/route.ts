// @ts-nocheck
import { NextResponse } from 'next/server';
import { getSheetByNameCached } from '../../../../lib/googleSheets';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ ok: true, results: [] });

  try {
    const sheet = await getSheetByNameCached('layout_importacao_empresas');
    const rows = sheet.data.values || [];
    if (!rows.length) return NextResponse.json({ ok: true, results: [] });
    const [header, ...data] = rows;
    const idxId = header.indexOf('Cliente_ID');
    const idxNome = header.indexOf('Nome da Empresa');
    const idxCnpj = header.indexOf('CNPJ Empresa');
    const qDigits = q.replace(/\D/g, '');
    const qLower = q.toLowerCase();
    const matches = data.filter((row) => {
      const nome = idxNome >= 0 ? (row[idxNome] || '').toLowerCase() : '';
      const cnpj = idxCnpj >= 0 ? (row[idxCnpj] || '').replace(/\D/g, '') : '';
      if (qDigits && cnpj === qDigits) return true;
      if (qLower && nome.includes(qLower)) return true;
      return false;
    }).map((row) => {
      const obj: any = {};
      header.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    return NextResponse.json({ ok: true, results: matches });
  } catch (err) {
    console.error('buscar clientes', err);
    return NextResponse.json({ ok: false, message: 'Erro na busca' }, { status: 500 });
  }
}
