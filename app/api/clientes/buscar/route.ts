import { NextResponse } from 'next/server';
import { getSheetByNameCached } from '../../../../lib/googleSheets';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase();
  const digits = q.replace(/\D/g, '');
  try {
    const sheet = await getSheetByNameCached('layout_importacao_empresas');
    const rows = (sheet.data.values || []) as string[][];
    const [header, ...data] = rows;
    const idx = {
      clienteId: header.indexOf('Cliente_ID'),
      nome: header.indexOf('Nome da Empresa'),
      cnpj: header.indexOf('CNPJ Empresa'),
    };
    const results = data.filter((row) => {
      const nome = (row[idx.nome] || '').toLowerCase();
      const cnpj = (row[idx.cnpj] || '').replace(/\D/g, '');
      return (digits && cnpj === digits) || (q && nome.includes(q));
    }).map((row) => ({
      clienteId: row[idx.clienteId] || '',
      nome: row[idx.nome] || '',
      cnpj: (row[idx.cnpj] || '').replace(/\D/g, ''),
    }));
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
