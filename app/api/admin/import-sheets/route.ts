import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { 
      googleClientEmail, 
      googlePrivateKey, 
      spreadsheetId,
      supabaseUrl,
      supabaseServiceKey
    } = await req.json();

    if (!googleClientEmail || !googlePrivateKey || !spreadsheetId || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Credenciais incompletas' }, { status: 400 });
    }

    // Corrigir a chave privada
    const formattedKey = googlePrivateKey.replace(/\\n/g, '\n');

    // Inicializar Google Sheets
    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Inicializar Supabase Service Role (para ignorar RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mapeamento de abas para tabelas
    const tables = [
      { sheet: "sheet1", table: "leads", pk: "cliente_id" },
      { sheet: "layout_importacao_empresas", table: "layout_importacao_empresas", pk: "cliente_id" },
      { sheet: "leads_exact_spotter", table: "leads_exact_spotter", pk: "cliente_id" },
      { sheet: "perdecomp", table: "perdecomp", pk: "perdcomp_id" },
      { sheet: "usuarios", table: "usuarios", pk: "usuario_id" },
      { sheet: "dic_tipos", table: "dic_tipos", pk: "tipo_codigo" },
      { sheet: "dic_creditos", table: "dic_creditos", pk: "credito_codigo" },
      { sheet: "rotas", table: "rotas", pk: "rota_codigo" },
      { sheet: "vocab_permissoes", table: "vocab_permissoes", pk: "chave" },
      { sheet: "teses", table: "teses", pk: "tese_id" },
      { sheet: "cnae", table: "cnae", pk: "cnae_id" }
    ];

    const results: any[] = [];

    for (const item of tables) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${item.sheet}!A:ZZ`,
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
          results.push({ table: item.table, status: 'vazia' });
          continue;
        }

        const headers = rows[0];
        const data = rows.slice(1).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] === "" ? null : row[index];
          });
          return obj;
        });

        // Upsert em lotes de 100
        const batchSize = 100;
        let success = 0;
        let errors = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const { error } = await supabase.from(item.table).upsert(batch, { onConflict: item.pk });
          if (error) {
            console.error(`Erro na tabela ${item.table}:`, error);
            errors += batch.length;
          } else {
            success += batch.length;
          }
        }

        results.push({ table: item.table, status: 'sucesso', total: data.length, success, errors });
      } catch (err: any) {
        results.push({ table: item.table, status: 'erro', message: err.message });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
