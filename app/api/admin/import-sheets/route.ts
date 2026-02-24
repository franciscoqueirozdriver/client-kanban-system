import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const bodyParams = await req.json();
    
    // Usar credenciais do corpo da requisição ou fallback para variáveis de ambiente da Vercel
    const googleClientEmail = (bodyParams.googleClientEmail && bodyParams.googleClientEmail.trim() !== "") ? bodyParams.googleClientEmail : process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = (bodyParams.googlePrivateKey && bodyParams.googlePrivateKey.trim() !== "") ? bodyParams.googlePrivateKey : process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = (bodyParams.spreadsheetId && bodyParams.spreadsheetId.trim() !== "") ? bodyParams.spreadsheetId : process.env.SPREADSHEET_ID;
    const supabaseUrl = (bodyParams.supabaseUrl && bodyParams.supabaseUrl.trim() !== "") ? bodyParams.supabaseUrl : process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Usar a Service Role Key (Admin) com múltiplos fallbacks de nomes comuns na Vercel
    const supabaseServiceKey = (bodyParams.supabaseServiceKey && bodyParams.supabaseServiceKey.trim() !== "") 
      ? bodyParams.supabaseServiceKey 
      : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY);

    if (!googleClientEmail || !googlePrivateKey || !spreadsheetId || !supabaseUrl || !supabaseServiceKey) {
      const missing = [];
      if (!googleClientEmail) missing.push('GOOGLE_CLIENT_EMAIL');
      if (!googlePrivateKey) missing.push('GOOGLE_PRIVATE_KEY');
      if (!spreadsheetId) missing.push('SPREADSHEET_ID');
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      return NextResponse.json({ 
        error: `Credenciais incompletas na Vercel: Faltando [${missing.join(', ')}]. Por favor, verifique as variáveis de ambiente.` 
      }, { status: 400 });
    }

    // Normalização Robusta da Chave Privada
    let formattedKey = googlePrivateKey;
    
    // 1. Remover aspas se existirem
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
      formattedKey = formattedKey.slice(1, -1);
    }
    
    // 2. Converter \n literais para quebras de linha reais
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // 3. Garantir que a chave tenha o formato PEM correto (cabeçalho, corpo, rodapé)
    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const cleanBody = formattedKey.replace(/\s/g, '');
      formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----`;
    } else {
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      const parts = formattedKey.split(header);
      if (parts.length > 1) {
        const bodyParts = parts[1].split(footer);
        if (bodyParts.length > 0) {
          const body = bodyParts[0].replace(/\s/g, '');
          const lines: string[] = []; // Definindo explicitamente como string[] para evitar erro de tipo
          for (let i = 0; i < body.length; i += 64) {
            lines.push(body.slice(i, i + 64));
          }
          formattedKey = `${header}\n${lines.join('\n')}\n${footer}\n`;
        }
      }
    }

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
          const { error } = await supabase.from(item.table).upsert(batch, { onConflict: item.pk as any });
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
            break; 
          } else {
            success += batch.length;
          }
        }

        if (errors === 0) {
          results.push({ table: item.table, status: 'sucesso', total: data.length, success, errors: 0 });
        }
      } catch (err: any) {
        results.push({ 
          table: item.table, 
          status: 'erro', 
          message: `Google Sheets Error: ${err.message} (Usando conta: ${googleClientEmail})` 
        });
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
