import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Payload = {
  cardId: string | number | null;
  cor: string;
};

function hasSheetEnvs() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

async function appendRow({ cardId, cor }: Payload) {
  const googleSpreadsheetModule = await import('google-spreadsheet');
  const GoogleSpreadsheetCtor = (googleSpreadsheetModule as any).GoogleSpreadsheet ?? (googleSpreadsheetModule as any).default;
  if (!GoogleSpreadsheetCtor) {
    throw new Error('google-spreadsheet não expôs GoogleSpreadsheet');
  }

  const googleAuthModule = await import('google-auth-library');
  const JWTCtor = (googleAuthModule as any).JWT ?? (googleAuthModule as any).default?.JWT;
  if (!JWTCtor) {
    throw new Error('JWT client não disponível na google-auth-library');
  }

  const jwtClient = new JWTCtor({
    email: process.env.GOOGLE_SERVICE_EMAIL as string,
    key: (process.env.GOOGLE_PRIVATE_KEY as string)?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheetCtor(process.env.GOOGLE_SHEETS_ID as string, jwtClient);

  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['Sheet1'] || doc.sheetsByIndex[0];
  if (!sheet) {
    throw new Error('Sheet1 não encontrada na planilha');
  }

  await sheet.loadHeaderRow().catch(() => {});
  const currentHeaders = Array.isArray(sheet.headerValues) ? sheet.headerValues : [];

  if (currentHeaders.length === 0) {
    await sheet.setHeaderRow(['CardId', 'Cor_Card', 'CreatedAt']);
  } else {
    const headers = new Set(currentHeaders);
    const needed = ['CardId', 'Cor_Card', 'CreatedAt'].filter((h) => !headers.has(h));
    if (needed.length > 0) {
      const merged = [...currentHeaders, ...needed];
      const deduped = merged.filter((col, idx) => merged.indexOf(col) === idx);
      await sheet.setHeaderRow(deduped);
    }
  }

  await sheet.addRow({
    CardId: cardId ?? '',
    Cor_Card: cor,
    CreatedAt: new Date().toISOString(),
  });
}

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

    if (!hasSheetEnvs()) {
      console.warn('[Sheets] Variáveis de ambiente ausentes. Operação ignorada.');
      return NextResponse.json({ ok: true, skipped: true });
    }

    await appendRow({ cardId: (body?.cardId as any) ?? null, cor });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Sheets] Falha ao gravar Cor_Card:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'SHEETS_WRITE_ERROR' },
      { status: 500 }
    );
  }
}
