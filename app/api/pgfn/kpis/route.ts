export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const args = {
    q: (searchParams.get('q') || '').trim(),
    min: Number(searchParams.get('min') || 0),
    max: Number(searchParams.get('max') || 9_999_999_999),
    tempo: searchParams.get('tempo') || 'all',
    aju: searchParams.get('aju') || 'all',
    tipo: searchParams.get('tipo') || 'all',
    uf: searchParams.get('uf') || 'all'
  } as const;

  const where: string[] = ['d.valor_consolidado BETWEEN $1 AND $2'];
  const params: any[] = [args.min, args.max];
  let paramIndex = params.length;

  if (args.q) {
    where.push(`(d.numero_inscricao ILIKE $${++paramIndex} OR d.nome_devedor ILIKE $${paramIndex} OR d.cpf_cnpj ILIKE $${paramIndex})`);
    params.push(`%${args.q}%`);
  }

  if (args.aju !== 'all') {
    where.push(`d.indicador_ajuizado = $${++paramIndex}`);
    params.push(args.aju === 'yes');
  }

  if (args.uf !== 'all') {
    where.push(`d.uf_devedor = $${++paramIndex}`);
    params.push(args.uf);
  }

  let joinItens = '';
  if (args.tipo !== 'all') {
    joinItens = 'JOIN public.devedores_pgfn_item i ON i.numero_inscricao = d.numero_inscricao';
    where.push(`i.tipo_credito = $${++paramIndex}`);
    params.push(args.tipo);
  }

  if (args.tempo === 'lt1') {
    where.push(`d.data_inscricao >= current_date - INTERVAL '1 year'`);
  } else if (args.tempo === 'btw13') {
    where.push(`d.data_inscricao >= current_date - INTERVAL '3 years' AND d.data_inscricao < current_date - INTERVAL '1 year'`);
  } else if (args.tempo === 'gt3') {
    where.push(`d.data_inscricao < current_date - INTERVAL '3 years'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    WITH base AS (
      SELECT d.*
      FROM public.devedores_pgfn d
      ${joinItens}
      ${whereSql}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(valor_consolidado), 0)::numeric(18, 2) AS soma,
      AVG(valor_consolidado)::numeric(18, 2) AS media,
      100.0 * AVG(CASE WHEN indicador_ajuizado THEN 1 ELSE 0 END) AS pct_aju,
      SUM(CASE WHEN data_inscricao >= current_date - INTERVAL '1 year' THEN 1 ELSE 0 END)::bigint AS recentes
    FROM base;
  `;

  const { rows } = await query(sql, params);
  const payload = rows[0] || { total: 0, soma: 0, media: 0, pct_aju: 0, recentes: 0 };

  return NextResponse.json(payload);
}
