import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import { padCNPJ14, onlyDigits } from '@/utils/cnpj';
const RESULT_LIMIT = 20;

// Normalizer function as specified
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();

interface ScoredCompany {
    cliente_id: string;
    nome_da_empresa: string;
    cnpj_empresa: string;
    score: number;
    nomeLength: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const qDigits = onlyDigits(q);

  if (q.length < 2 && qDigits.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { rows } = await getSheetData(SHEETS.LEADS_EXACT_SPOTTER);

    const scoredResults = rows.map(row => {
      const nomeRaw = String(row.nome_da_empresa || row.nome_do_lead || '');
      const cnpjRaw = String(row.cpf_cnpj || '');

      const nome = norm(nomeRaw);
      const cnpj = onlyDigits(cnpjRaw);

      if (!nome && !cnpj) {
        return null;
      }

      let score = 0;
      if (qDigits.length === 14 && cnpj === qDigits) {
        score = 1000;
      } else {
        const nq = norm(q);
        const tokens = nq.split(' ').filter(Boolean);

        const starts = nome.startsWith(nq) ? 1 : 0;
        const containsAll = tokens.every(t => nome.includes(t)) ? 1 : 0;
        const cnpjContains = qDigits.length >= 5 && cnpj.includes(qDigits) ? 1 : 0;

        score = (starts * 800) + (containsAll * 700) + (cnpjContains * 500);
      }

      if (score === 0) {
        return null;
      }

      return {
        cliente_id: row.cliente_id,
        nome_da_empresa: nomeRaw,
        cnpj_empresa: padCNPJ14(cnpjRaw),
        score,
        nomeLength: nomeRaw.length,
      };
    }).filter(Boolean);

    // Deduplicate results, keeping the one with the highest score
    const deduplicated: ScoredCompany[] = Array.from(
      (scoredResults as ScoredCompany[]).reduce((map, item) => {
        const key = item.cnpj_empresa || item.nome_da_empresa; // Use CNPJ or Name as key
        if (!map.has(key) || item.score > map.get(key)!.score) {
          map.set(key, item);
        }
        return map;
      }, new Map<string, ScoredCompany>()).values()
    );

    // Sort the results
    deduplicated.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.nomeLength !== b.nomeLength) {
        return a.nomeLength - b.nomeLength;
      }
      return a.nome_da_empresa.localeCompare(b.nome_da_empresa);
    });

    // Limit and map to final structure
    const finalResults = deduplicated.slice(0, RESULT_LIMIT).map(item => ({
      cliente_id: item.cliente_id,
      nome_da_empresa: item.nome_da_empresa,
      cnpj_empresa: item.cnpj_empresa,
    }));

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
