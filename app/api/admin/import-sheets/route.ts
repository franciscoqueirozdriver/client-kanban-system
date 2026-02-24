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

    // Mapeamento completo de abas para tabelas
    const tables = [
      { sheet: "sheet1", table: "leads", pk: "cliente_id" },
      { sheet: "layout_importacao_empresas", table: "layout_importacao_empresas", pk: "cliente_id" },
      { sheet: "leads_exact_spotter", table: "leads_exact_spotter", pk: "cliente_id" },
      { sheet: "perdecomp", table: "perdecomp", pk: "perdcomp_id" },
      { sheet: "perdecomp_itens", table: "perdecomp_itens", pk: undefined },
      { sheet: "perdecomp_facts", table: "perdecomp_facts", pk: undefined },
      { sheet: "perdecomp_snapshot", table: "perdecomp_snapshot", pk: undefined },
      { sheet: "padroes", table: "padroes", pk: undefined },
      { sheet: "historico_interacoes", table: "historico_interacoes", pk: "message_id" },
      { sheet: "mensagens", table: "mensagens", pk: undefined },
      { sheet: "historico_whats_app", table: "historico_whats_app", pk: undefined },
      { sheet: "usuarios", table: "usuarios", pk: "usuario_id" },
      { sheet: "dic_tipos", table: "dic_tipos", pk: "tipo_codigo" },
      { sheet: "dic_naturezas", table: "dic_naturezas", pk: undefined },
      { sheet: "dic_creditos", table: "dic_creditos", pk: "credito_codigo" },
      { sheet: "dic_situacoes", table: "dic_situacoes", pk: undefined },
      { sheet: "rotas", table: "rotas", pk: "rota_codigo" },
      { sheet: "permissoes", table: "permissoes", pk: undefined },
      { sheet: "vocab_permissoes", table: "vocab_permissoes", pk: "chave" },
      { sheet: "roles_default", table: "roles_default", pk: undefined },
      { sheet: "auditoria_acesso", table: "auditoria_acesso", pk: "evento_id" },
      { sheet: "auditoria_acao", table: "auditoria_acao", pk: "evento_id" },
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
            results.push({ 
              table: item.table, 
              status: 'erro', 
              success, 
              errors, 
              message: `Supabase Error: ${error.message} (${error.code})` 
            });
            break; // Para no primeiro erro do lote para não poluir
          } else {
            success += batch.length;
          }
        }

        if (errors === 0) {
          results.push({ table: item.table, status: 'sucesso', total: data.length, success, errors: 0 });
        }
      } catch (err: any) {
        results.push({ table: item.table, status: 'erro', message: `Google Sheets Error: ${err.message}` });
      }
    }

    // Salvar log da migração no Supabase
    const status = results.every(r => r.status === 'sucesso') ? 'sucesso' : 
                  results.some(r => r.status === 'sucesso') ? 'parcial' : 'erro';
    
    await supabase.from('migration_logs').insert({
      spreadsheet_id: spreadsheetId,
      results,
      status
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    // Tentar salvar log de erro fatal
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabase.from('migration_logs').insert({
        status: 'erro',
        error_message: error.message
      });
    } catch (e) {
      console.error('Falha ao salvar log de erro fatal:', e);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
