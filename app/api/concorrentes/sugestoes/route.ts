import { NextResponse } from 'next/server';
import { findCompetitors } from '@/lib/perplexity';

export const runtime = 'nodejs';

const onlyDigits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const limit = Math.min(Math.max(Number(body?.limit) || 0, 1), 50);
    const rawCnpj = onlyDigits(body?.cnpj ?? '');
    const normalizedCnpj = rawCnpj.length === 14 ? rawCnpj : undefined;

    if (!name) {
      return NextResponse.json({ items: [] });
    }

    const { items: rawItems = [] } = await findCompetitors({ nome: name, max: limit });

    const seenCnpjs = new Set<string>();
    const seenFallback = new Set<string>();
    const items: Array<{ id?: string; nome: string; cnpj?: string }> = [];

    rawItems.forEach((raw: any, index: number) => {
      const nome = String(raw?.nome ?? raw?.name ?? '').trim();
      if (!nome) return;

      const cnpjDigits = onlyDigits(raw?.cnpj ?? raw?.documento ?? raw?.cnpj_numero ?? '');
      const cnpj = cnpjDigits.slice(0, 14);
      const id = raw?.id ? String(raw.id) : undefined;
      const fallbackKey = id || `${nome}-${index}`;

      if (cnpj) {
        if (seenCnpjs.has(cnpj)) return;
        seenCnpjs.add(cnpj);
      } else {
        if (seenFallback.has(fallbackKey)) return;
        seenFallback.add(fallbackKey);
      }

      items.push({ id, nome, cnpj: cnpj || undefined });
    });

    if (normalizedCnpj) {
      items.sort((a, b) => {
        const aMatch = a.cnpj === normalizedCnpj ? 1 : 0;
        const bMatch = b.cnpj === normalizedCnpj ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return 0;
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[api concorrentes/sugestoes] erro', error);
    return NextResponse.json({ items: [] });
  }
}
