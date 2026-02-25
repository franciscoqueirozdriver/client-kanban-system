import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLikelyJwt(key: any): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  const parts = trimmed.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

function convertToIsoDate(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY ou D/M/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = trimmed.match(ddmmyyyy);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Already ISO? (YYYY-MM-DD)
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(trimmed)) return trimmed.split('T')[0];

  return null;
}

export async function POST(req: NextRequest) {
  try {
    let bodyParams: any = {};
    try {
      bodyParams = await req.json();
    } catch (e) {}

    const isValidValue = (v: any) => v && v !== 'undefined' && v !== 'null';

    const googleClientEmail = isValidValue(bodyParams.googleClientEmail) ? bodyParams.googleClientEmail : process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = isValidValue(bodyParams.googlePrivateKey) ? bodyParams.googlePrivateKey : process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = isValidValue(bodyParams.spreadsheetId) ? bodyParams.spreadsheetId : process.env.SPREADSHEET_ID;
    const supabaseUrl = isValidValue(bodyParams.supabaseUrl) ? bodyParams.supabaseUrl : (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);

    const keyCandidates = [
      bodyParams.supabaseServiceKey,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_SERVICE_KEY,
      process.env.SUPABASE_SECRET_KEY
    ].filter(isValidValue);

    const supabaseServiceKey = keyCandidates.find(isLikelyJwt) || keyCandidates[0] || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!googleClientEmail || !googlePrivateKey || !spreadsheetId || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Credenciais incompletas." }, { status: 400 });
    }

    let formattedKey = googlePrivateKey;
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const cleanBody = formattedKey.replace(/\s/g, '');
      formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----`;
    }

    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const spreadsheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheetMetadata.data.sheets?.map(s => s.properties?.title) || [];

    const results: any[] = [];

    const loadSheetData = async (sheetName: string) => {
      let actualName = sheetName;
      if (!existingSheets.includes(actualName)) {
        const variations = [sheetName.replace('perdecomp', 'perdcomp'), sheetName.replace('perdecomp', 'percomp')];
        const found = variations.find(v => existingSheets.includes(v));
        if (found) actualName = found;
        else return null;
      }
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${actualName}!A:ZZ` });
      return response.data.values;
    };

    // ETAPA 1: Extração de Clientes em Memória
    const clientSourceSheets = [
      { name: "layout_importacao_empresas", id: "cliente_id", nome: "nome_da_empresa", cnpj: "cnpj_empresa" },
      { name: "leads_exact_spotter", id: "cliente_id", nome: "nome_da_empresa", cnpj: "cpf_cnpj" },
      { name: "sheet1", id: "negocio_id", nome: "negocio_organizacao", cnpj: null }
    ];

    const clientsMap = new Map<string, any>();

    for (const source of clientSourceSheets) {
      const rows = await loadSheetData(source.name);
      if (!rows || rows.length < 2) continue;

      const headers = rows[0];
      rows.slice(1).forEach(row => {
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });

        const cid = obj[source.id] || obj.cliente_id || obj.negocio_id;
        if (cid && !clientsMap.has(cid)) {
          clientsMap.set(cid, {
            cliente_id: cid,
            nome_da_empresa: obj[source.nome] || null,
            cnpj_empresa: source.cnpj ? obj[source.cnpj] : null,
          });
        }
      });
    }

    if (clientsMap.size > 0) {
      const clientsBatch = Array.from(clientsMap.values());
      // Tentar inserir na tabela 'clientes' (conforme solicitado pelo usuário)
      const { error } = await supabase.from('clientes').upsert(clientsBatch, { onConflict: 'cliente_id' });
      if (error) {
        console.warn('Erro ao inserir em clientes (extração):', error.message);
        results.push({ table: 'clientes (extração)', status: 'erro', total: clientsBatch.length, message: error.message });
      } else {
        results.push({ table: 'clientes (extração)', status: 'sucesso', total: clientsBatch.length });
      }
    }

    // ETAPA 2: Importação Principal
    const tables = [
      { sheet: "sheet1", table: "negocios", pk: "negocio_id" },
      { sheet: "perdecomp", table: "perdecomp", pk: "perdcomp_id" }, // Tentando perdcomp_id como PK
      { sheet: "perdecomp_itens", table: "perdecomp_itens", pk: undefined },
      { sheet: "perdecomp_facts", table: "perdecomp_facts", pk: undefined },
      { sheet: "perdecomp_snapshot", table: "perdecomp_snapshot", pk: undefined },
      { sheet: "layout_importacao_empresas", table: "layout_importacao_empresas", pk: undefined },
      { sheet: "leads_exact_spotter", table: "leads_exact_spotter", pk: undefined },
      { sheet: "padroes", table: "padroes", pk: undefined },
      { sheet: "historico_interacoes", table: "historico_interacoes", pk: "message_id" },
      { sheet: "mensagens", table: "mensagens", pk: undefined },
      { sheet: "usuarios", table: "usuarios", pk: "usuario_id" },
      { sheet: "teses", table: "teses", pk: "tese_id" },
      { sheet: "cnae", table: "cnae", pk: "cnae_id" }
    ];

    for (const item of tables) {
      const rows = await loadSheetData(item.sheet);
      if (!rows || rows.length < 2) {
        if (!results.find(r => r.table === item.table)) results.push({ table: item.table, status: 'vazia' });
        continue;
      }

      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          const value = row[index];
          obj[header] = (value === "" || value === undefined) ? null : value;
        });

        // Conversão de datas
        const dateFields = ["periodo_inicio", "periodo_fim", "data_protocolo", "ultima_atualizacao", "data_consulta", "perdcomp_data_transmissao", "negocio_data_de_fechamento_esperada", "negocio_data_da_proxima_atividade", "negocio_data_de_criacao_do_negocio", "negocio_ganho_em", "negocio_data_de_perda", "negocio_negocio_fechado_em", "negocio_data_atualizada", "negocio_data_da_ultima_atividade"];
        dateFields.forEach(f => {
          if (obj[f]) {
            const iso = convertToIsoDate(obj[f]);
            if (iso) obj[f] = iso;
          }
        });

        // Garantir que não enviamos IDs que o banco deve gerar automaticamente
        if (item.table === 'layout_importacao_empresas' || item.table === 'leads_exact_spotter') {
          delete obj.oportunidade_id;
        }
        if (item.table === 'historico_interacoes' && !obj.message_id) {
          obj.message_id = crypto.randomUUID();
        }

        // Mapeamento negócio_id
        if (item.table === 'negocios' && !obj.negocio_id && obj.cliente_id) {
           obj.negocio_id = obj.cliente_id;
        }

        return obj;
      });

      const batchSize = 100;
      let success = 0;
      let errors = 0;
      let lastErrorMessage = '';

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        let query: any;
        if (item.pk) {
          query = supabase.from(item.table).upsert(batch, { onConflict: item.pk });
        } else {
          query = supabase.from(item.table).insert(batch);
        }

        const { error } = await query;
        if (error) {
          // Se for erro de tabela inexistente e for 'negocios', tentar 'leads' como fallback
          if (item.table === 'negocios' && error.message.includes('not found')) {
             const { error: errLeads } = await supabase.from('leads').upsert(batch, { onConflict: 'cliente_id' });
             if (!errLeads) {
                success += batch.length;
             } else {
                errors += batch.length;
                lastErrorMessage = errLeads.message;
                break;
             }
          } else {
             errors += batch.length;
             lastErrorMessage = error.message;
             console.error(`Erro na tabela ${item.table}:`, error.message);
             break;
          }
        } else {
          success += batch.length;
        }
      }

      results.push({ table: item.table, status: errors > 0 ? 'erro' : 'sucesso', total: data.length, success, errors, message: lastErrorMessage });
    }

    await supabase.from('migration_logs').insert({ spreadsheet_id: spreadsheetId, results, status: results.every(r => r.status !== 'erro') ? 'sucesso' : 'parcial' });
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
