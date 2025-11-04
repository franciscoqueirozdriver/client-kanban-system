import { NextResponse } from 'next/server';
import { updateCorCard } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

type Payload = {
  cardId: string | number | null;
  cor: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const cor = String(body?.cor ?? '').trim();
    const cardId = String(body?.cardId ?? '').trim();

    if (!cor || !cardId) {
      return NextResponse.json(
        { ok: false, error: 'Campos "cardId" e "cor" são obrigatórios.' },
        { status: 400 }
      );
    }

    // updateCorCard usa o findRowNumberByClienteId (que usa cliente_id) 
    // e o updateCorCard atualizado usa o campo 'cor_card' em snake_case
    await updateCorCard(parseInt(cardId, 10), cor);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Sheets] Falha ao gravar Cor_Card:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'SHEETS_WRITE_ERROR' },
      { status: 500 }
    );
  }
}
