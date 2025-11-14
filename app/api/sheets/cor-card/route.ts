import { NextResponse } from 'next/server';
import { appendRow } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';

export const dynamic = 'force-dynamic';

type Payload = {
  cardId: string | number | null;
  cor: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const cor = String(body?.cor ?? '').trim();

    if (!cor) {
      return NextResponse.json(
        { ok: false, error: 'Campo "cor" é obrigatório (ex.: "purple").' },
        { status: 400 }
      );
    }

    const newRow = {
      cliente_id: body?.cardId ?? '',
      cor_card: cor,
      data_ultima_movimentacao: new Date().toISOString(),
    };

    await appendRow(SHEETS.SHEET1, newRow);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Sheets] Falha ao gravar Cor_Card:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'SHEETS_WRITE_ERROR' },
      { status: 500 }
    );
  }
}
