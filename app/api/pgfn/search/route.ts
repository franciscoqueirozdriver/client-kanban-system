export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const min = Number(searchParams.get("min") || 0);
  const max = Number(searchParams.get("max") || 9_999_999_999);
  const tempo = searchParams.get("tempo") || "all"; // lt1 | btw13 | gt3 | all
  const aju = searchParams.get("aju") || "all"; // yes | no | all
  const tipo = searchParams.get("tipo") || "all"; // FGTS | Previdenciário | CIDA | Demais Débitos | all
  const uf = searchParams.get("uf") || "all";
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const size = Math.min(Math.max(Number(searchParams.get("size") || 25), 1), 200);
  const offset = (page - 1) * size;

  const where: string[] = ["d.valor_consolidado BETWEEN $1 AND $2"];
  const params: any[] = [min, max];
  let p = params.length;

  if (q) {
    where.push(`(
      d.numero_inscricao ILIKE $${++p} OR
      d.nome_devedor     ILIKE $${p} OR
      d.cpf_cnpj         ILIKE $${p}
    )`);
    params.push(`%${q}%`);
  }

  if (aju !== "all") {
    where.push(`d.indicador_ajuizado = $${++p}`);
    params.push(aju === "yes");
  }

  if (uf !== "all") {
    where.push(`d.uf_devedor = $${++p}`);
    params.push(uf);
  }

  let joinItens = "";
  if (tipo !== "all") {
    joinItens =
      "JOIN public.devedores_pgfn_item i ON i.numero_inscricao = d.numero_inscricao";
    where.push(`i.tipo_credito = $${++p}`);
    params.push(tipo);
  }

  if (tempo === "lt1") {
    where.push(`d.data_inscricao >= current_date - INTERVAL '1 year'`);
  } else if (tempo === "btw13") {
    where.push(`d.data_inscricao >= current_date - INTERVAL '3 years' AND d.data_inscricao < current_date - INTERVAL '1 year'`);
  } else if (tempo === "gt3") {
    where.push(`d.data_inscricao < current_date - INTERVAL '3 years'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    WITH base AS (
      SELECT d.cpf_cnpj, d.nome_devedor, d.valor_consolidado, d.data_inscricao,
             d.indicador_ajuizado, d.uf_devedor, d.numero_inscricao,
             COALESCE(i.tipo_credito, NULL) AS tipo_credito
      FROM public.devedores_pgfn d
      ${joinItens}
      ${whereSql}
      ORDER BY d.valor_consolidado DESC, d.nome_devedor ASC
      LIMIT ${size} OFFSET ${offset}
    ),
    total AS (
      SELECT COUNT(*) AS total
      FROM public.devedores_pgfn d
      ${joinItens}
      ${whereSql}
    )
    SELECT jsonb_build_object(
      'rows',     jsonb_agg(jsonb_build_object(
                    'cnpj', d.cpf_cnpj,
                    'nome', d.nome_devedor,
                    'valor', d.valor_consolidado,
                    'data', to_char(d.data_inscricao, 'YYYY-MM-DD'),
                    'ajuizado', d.indicador_ajuizado,
                    'uf', d.uf_devedor,
                    'inscricao', d.numero_inscricao,
                    'tipo', d.tipo_credito
                  ) ORDER BY 1 DESC),
      'total',    (SELECT total FROM total)
    ) AS payload
    FROM base d;
  `;

  const { rows } = await query(sql, params);
  const payload = rows[0]?.payload ?? { rows: [], total: 0 };

  return NextResponse.json(payload);
}
