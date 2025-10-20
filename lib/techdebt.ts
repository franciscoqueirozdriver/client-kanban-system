// lib/techdebt.ts
// Registrador de “pendências de migração” (fallbacks/aliases) em uma aba do Google Sheets.
// - Cria a aba MIGRATION_PENDING se não existir.
// - Deduplica eventos idênticos no mesmo dia.
// - Nunca derruba o fluxo: falhas de log viram console.warn.

import { google, sheets_v4 } from 'googleapis';

const PENDING_SHEET =
  process.env.MIGRATION_PENDING_SHEET_NAME || 'migration_pending';
const DATE_TZ = process.env.TZ || 'America/Sao_Paulo';

// Scopes mínimos para criar aba e escrever valores.
const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

type PendingType =
  | 'sheet-name-fallback'
  | 'sheet-alias-hit'
  | 'header-map';

export type PendingRow = {
  ts_iso: string;
  date_local: string;
  type: PendingType;
  requested?: string;
  resolved?: string;
  spreadsheet_id?: string;
  route?: string;
  extra?: string;
};

let _sheetsClient: sheets_v4.Sheets | null = null;

async function getSheets(): Promise<sheets_v4.Sheets> {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({ scopes: SHEETS_SCOPES });
  google.options({ auth }); // sem httpAgent
  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

async function ensurePendingSheet(spreadsheetId: string): Promise<void> {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title?.toLowerCase() === PENDING_SHEET.toLowerCase()
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: PENDING_SHEET } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PENDING_SHEET}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'ts_iso','date_local','type','requested','resolved','spreadsheet_id','route','extra'
        ]]
      }
    });
  }
}

function todayLocalISO(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DATE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (err) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }
}

function dedupeKey(r: PendingRow): string {
  return [
    r.date_local,
    r.type,
    (r.requested || '').toLowerCase(),
    (r.resolved || '').toLowerCase(),
  ].join('|');
}

const seen = new Set<string>();

export async function recordPending(
  p: Partial<PendingRow> & { type: PendingType; spreadsheet_id?: string }
): Promise<void> {
  try {
    const spreadsheetId = p.spreadsheet_id || process.env.SHEETS_ID;
    if (!spreadsheetId) {
      console.warn('[techdebt:skip] SHEETS_ID ausente.', p);
      return;
    }

    await ensurePendingSheet(spreadsheetId);

    const row: PendingRow = {
      ts_iso: new Date().toISOString(),
      date_local: todayLocalISO(),
      type: p.type,
      requested: p.requested || '',
      resolved: p.resolved || '',
      spreadsheet_id: spreadsheetId,
      route: p.route || '',
      extra:
        typeof p.extra === 'string'
          ? p.extra
          : p.extra
          ? JSON.stringify(p.extra)
          : '',
    };

    const key = dedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);

    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PENDING_SHEET}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          row.ts_iso,
          row.date_local,
          row.type,
          row.requested,
          row.resolved,
          row.spreadsheet_id,
          row.route,
          row.extra
        ]]
      },
    });
  } catch (e: any) {
    console.warn('[techdebt:error]', e?.message || e);
  }
}
