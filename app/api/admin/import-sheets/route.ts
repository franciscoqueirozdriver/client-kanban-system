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
  if (typeof val === 'string' && /^#+$/.test(val.trim())) return null;
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

function sanitizeNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  let str = String(val).trim();
  str = str.replace(',', '.');
  const num = Number(str);
  return isNaN(num) ? null : num;
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

    // Importação Principal
    const tables = [
      { sheet: "sheet1", table: "leads", pk: "cliente_id" },
      { sheet: "perdecomp", table: "perdecomp", pk: "url_comprovante_html" },
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

        if (item.table === 'leads') {
          const numericFields = [
            'negocio_valor', 'negocio_vlr_mensalidade', 'negocio_vlr_implantacao',
            'negocio_mrr', 'negocio_acv', 'negocio_arr', 'negocio_probabilidade',
            'negocio_valor_de_produtos', 'negocio_valor_ponderado'
          ];
          numericFields.forEach(f => {
            if (obj[f] !== undefined) {
              obj[f] = sanitizeNumeric(obj[f]);
            }
          });
        }
        if (item.table === 'historico_interacoes' && !obj.message_id) {
          obj.message_id = crypto.randomUUID();
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
          errors += batch.length;
          lastErrorMessage = error.message;
          console.error(`Erro na tabela ${item.table}:`, error.message);
          break;
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
