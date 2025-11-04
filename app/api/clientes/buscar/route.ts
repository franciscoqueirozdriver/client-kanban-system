import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets.js';
import { normalizeCNPJ, toDigits } from '@/src/utils/cnpj';

const SHEET_NAME = 'Sheet1';
const RESULT_LIMIT = 20;

// Normalizer function as specified
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();

interface ScoredCompany {
    Cliente_ID: string;
    Nome_da_Empresa: string;
    CNPJ_Empresa: string;
    score: number;
    nomeLength: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const qDigits = toDigits(q);

  if (q.length < 2 && qDigits.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { rows } = await getSheetData(SHEET_NAME);

    const scoredResults = rows.map(row => {
      const nomeRaw = row['Nome da Empresa'] || row['Nome do Lead'] || '';
      const cnpjRaw = row['CPF/CNPJ'] || '';

      const nome = norm(nomeRaw);
      const cnpj = toDigits(cnpjRaw);

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
        Cliente_ID: row['Cliente_ID'],
        Nome_da_Empresa: nomeRaw,
        CNPJ_Empresa: normalizeCNPJ(cnpjRaw),
        score,
        nomeLength: nomeRaw.length,
      };
    }).filter(Boolean);

    // Deduplicate results, keeping the one with the highest score
    const deduplicated: ScoredCompany[] = Array.from(
      (scoredResults as ScoredCompany[]).reduce((map, item) => {
        const key = item.CNPJ_Empresa || item.Nome_da_Empresa; // Use CNPJ or Name as key
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
      return a.Nome_da_Empresa.localeCompare(b.Nome_da_Empresa);
    });

    // Limit and map to final structure
    const finalResults = deduplicated.slice(0, RESULT_LIMIT).map(item => ({
      Cliente_ID: item.Cliente_ID,
      Nome_da_Empresa: item.Nome_da_Empresa,
      CNPJ_Empresa: item.CNPJ_Empresa,
    }));

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
