// pages/api/clientes.ts
import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { mapRows } from '@/lib/mappers/fromSheet';
import { NextApiRequest, NextApiResponse } from 'next';

const TAB = 'layout_importacao_empresas' as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // getSheetData deve retornar array de objetos com chaves = cabeçalhos originais
    const { rows: raw } = await getSheetData(process.env.SPREADSHEET_ID!, TAB);

    const data = mapRows(TAB, raw);

    const out = (Array.isArray(data) ? data : []).map((r: any) => ({
      ...r,
      segmento: r?.segmento ?? r?.organizacao_segmento ?? null,
    }));

    // Failsafe: garante que o front nunca receba undefined e evita .length de undefined
    res.status(200).json(out);
  } catch {
    // Enquanto mapeamento/planilha estiverem em transição, não deixe a página cair
    res.status(200).json([]);
  }
}
