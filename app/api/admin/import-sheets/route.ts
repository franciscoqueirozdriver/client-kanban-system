import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Forçar o runtime do Node.js para garantir acesso às variáveis de ambiente
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const bodyParams = await req.json();
    
    // Captura explícita com fallback
    const googleClientEmail = bodyParams.googleClientEmail || process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = bodyParams.googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = bodyParams.spreadsheetId || process.env.SPREADSHEET_ID;
    const supabaseUrl = bodyParams.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = bodyParams.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!googleClientEmail || !googlePrivateKey || !spreadsheetId || !supabaseUrl || !supabaseServiceKey) {
      const missing: string[] = [];
      if (!googleClientEmail) missing.push('GOOGLE_CLIENT_EMAIL');
      if (!googlePrivateKey) missing.push('GOOGLE_PRIVATE_KEY');
      if (!spreadsheetId) missing.push('SPREADSHEET_ID');
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      return NextResponse.json({ 
        error: `Credenciais incompletas na Vercel. Faltando: [${missing.join(', ')}].`,
        availableKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('GOOGLE'))
      }, { status: 400 });
    }

    // Normalização da Chave Privada
    let formattedKey = googlePrivateKey;
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const cleanBody = formattedKey.replace(/\s/g, '');
      formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----`;
    }

    // Inicializar Google Sheets
    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Inicializar Supabase com Service Role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mapeamento de abas
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

    const spreadsheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheetMetadata.data.sheets?.map(s => s.properties?.title) || [];

    const results: any[] = [];

    for (const item of tables) {
      try {
        let actualSheetName = item.sheet;
        if (!existingSheets.includes(actualSheetName)) {
          const variations = [
            item.sheet.replace('perdecomp', 'perdcomp'),
            item.sheet.replace('perdecomp', 'percomp'),
          ];
          const found = variations.find(v => existingSheets.includes(v));
          if (found) actualSheetName = found;
          else {
            results.push({ table: item.table, status: 'erro', message: `Aba não encontrada.` });
            continue;
          }
        }

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${actualSheetName}!A:ZZ`,
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

        const batchSize = 100;
        let success = 0;
        let errors = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const { error } = await supabase.from(item.table).upsert(batch, { onConflict: item.pk as any });
          if (error) {
            errors += batch.length;
            results.push({ table: item.table, status: 'erro', message: error.message });
            break; 
          } else {
            success += batch.length;
          }
        }

        if (errors === 0) {
          results.push({ table: item.table, status: 'sucesso', total: data.length, success, errors: 0 });
        }
      } catch (err: any) {
        results.push({ table: item.table, status: 'erro', message: err.message });
      }
    }

    // Salvar log
    await supabase.from('migration_logs').insert({
      spreadsheet_id: spreadsheetId,
      results,
      status: results.every(r => r.status === 'sucesso') ? 'sucesso' : 'parcial'
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
