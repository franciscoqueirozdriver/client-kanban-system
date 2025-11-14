// app/api/perdecomp/verificar/route.ts
import { NextResponse } from 'next/server';
import { readSheet } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import { padCNPJ14 } from '@/utils/cnpj';
import type { PerdcompFactsRow } from '@/types/perdecomp';

const PERDECOMP_FACTS_SHEET = SHEETS.PERDCOMP_FACTS; // ajuste se o nome for outro

function parseDate(value?: string | null): number {
  if (!value) return 0;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getTime();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj')?.trim();

  if (!cnpj) {
    return NextResponse.json(
      { message: 'Query parameter "cnpj" is required' },
      { status: 400 },
    );
  }

  const cleanCnpj = padCNPJ14(cnpj);

  try {
    const rows = await readSheet<PerdcompFactsRow>(PERDECOMP_FACTS_SHEET);

    const dataForCnpj = rows.filter((row) => {
      const rowCnpj = padCNPJ14(row.cnpj || '');
      return rowCnpj === cleanCnpj;
    });

    if (dataForCnpj.length === 0) {
      return NextResponse.json({ lastConsultation: null }, { status: 200 });
    }

    // 🔴 Ponto crítico: usar SEMPRE data_consulta como referência
    const mostRecentConsultation = dataForCnpj.reduce<string | null>(
      (latest, row) => {
        const currentTime = parseDate(row.data_consulta);
        if (!latest) {
          return row.data_consulta ?? null;
        }
        const latestTime = parseDate(latest);
        return currentTime > latestTime ? row.data_consulta ?? latest : latest;
      },
      null,
    );

    return NextResponse.json(
      { lastConsultation: mostRecentConsultation },
      { status: 200 },
    );
  } catch (error) {
    console.error('[API /perdecomp/verificar]', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      {
        message: 'Failed to verify consultation',
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
