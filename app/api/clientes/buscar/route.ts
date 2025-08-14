import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').trim();
  const { rows } = await getSheetData('layout_importacao_empresas');
  const lower = q.toLowerCase();
  const results = rows.filter((r:any) => {
    const cnpj = String(r['CNPJ Empresa'] || '').replace(/\D+/g, '');
    const nome = String(r['Nome da Empresa'] || '').toLowerCase();
    if (/^\d+$/.test(q)) {
      return cnpj === q.replace(/\D+/g, '');
    }
    return nome.includes(lower);
  }).map((r:any)=>({
    Cliente_ID: r['Cliente_ID'] || '',
    Nome: r['Nome da Empresa'] || '',
    CNPJ: String(r['CNPJ Empresa'] || '').replace(/\D+/g,'')
  }));
  return NextResponse.json({ ok:true, resultados: results });
}
