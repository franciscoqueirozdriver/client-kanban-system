import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets.js';
import { normalizeCNPJ, toDigits } from '@/src/utils/cnpj';
import { mapClienteRow } from '@/lib/mappers/sheetsToDomain';
import { Cliente } from '@/types/cliente';

const SHEET_NAME = 'sheet1';
const RESULT_LIMIT = 20;

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();

interface ScoredCliente extends Cliente {
    score: number;
    nomeLength: number;
}

function isCliente(obj: any): obj is Cliente {
    return obj && typeof obj.nome_da_empresa === 'string' && typeof obj.cpf_cnpj === 'string';
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
      const cliente = mapClienteRow(row);

      if (!isCliente(cliente)) {
        return null;
      }

      const nome = norm(cliente.nome_da_empresa || '');
      const cnpj = toDigits(cliente.cpf_cnpj || '');

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
        ...cliente,
        cpf_cnpj: normalizeCNPJ(cliente.cpf_cnpj || ''),
        score,
        nomeLength: cliente.nome_da_empresa.length,
      };
    }).filter((result): result is ScoredCliente => result !== null);

    const deduplicated = Array.from(
      scoredResults.reduce((map, item) => {
        const key = item.cpf_cnpj || item.nome_da_empresa;
        if (key && (!map.has(key) || item.score > map.get(key)!.score)) {
          map.set(key, item);
        }
        return map;
      }, new Map<string, ScoredCliente>()).values()
    );

    deduplicated.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.nomeLength !== b.nomeLength) {
        return a.nomeLength - b.nomeLength;
      }
      return a.nome_da_empresa.localeCompare(b.nome_da_empresa);
    });

    const finalResults = deduplicated.slice(0, RESULT_LIMIT).map(item => ({
      cliente_id: item.cliente_id,
      nome_da_empresa: item.nome_da_empresa,
      cpf_cnpj: item.cpf_cnpj,
    }));

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error('Error searching clients:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to search clients', error: errorMessage }, { status: 500 });
  }
}
