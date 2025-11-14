import { NextRequest, NextResponse } from 'next/server';
import { readSheet } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import type { PerdcompFactsRow } from '@/types/perdecomp';

function parseDate(value?: string | null): number {
  if (!value) return 0;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getTime();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const cnpj = searchParams.get('cnpj');
    const perdcompId = searchParams.get('perdcomp_id');

    if (!cnpj && !perdcompId) {
      return NextResponse.json(
        { error: 'cnpj or perdcomp_id is required' },
        { status: 400 },
      );
    }

    const facts = await readSheet<PerdcompFactsRow>(SHEETS.PERDCOMP_FACTS);

    let filtered = facts;

    if (cnpj) {
      filtered = filtered.filter(
        (row) => row.cnpj && row.cnpj.replace(/\D/g, '') === cnpj.replace(/\D/g, ''),
      );
    }

    if (perdcompId) {
      filtered = filtered.filter(
        (row) =>
          String(row.perdcomp_id ?? '').trim() === String(perdcompId).trim(),
      );
    }

    if (filtered.length === 0) {
      return NextResponse.json(
        { found: false, record: null },
        { status: 200 },
      );
    }

    // 🚨 PONTO CRÍTICO:
    // Sempre usar data_consulta como referência de "mais recente"
    const latest = filtered.reduce<PerdcompFactsRow | null>((acc, row) => {
      if (!acc) return row;

      const accTime = parseDate(acc.data_consulta);
      const rowTime = parseDate(row.data_consulta);

      return rowTime > accTime ? row : acc;
    }, null);

    return NextResponse.json(
      {
        found: true,
        record: latest,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Failed to verify PERDCOMP record',
        message: err?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
