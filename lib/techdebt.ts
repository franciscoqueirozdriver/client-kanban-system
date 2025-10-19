import https from 'https';
import { google, sheets_v4 } from 'googleapis';

const PENDING_SHEET = process.env.MIGRATION_PENDING_SHEET_NAME || 'migration_pending';
const DATE_TZ = process.env.TZ || 'America/Sao_Paulo';

let sheetsClientPromise: Promise<sheets_v4.Sheets> | undefined;
const seen = new Set<string>();

type PendingType = 'sheet-name-fallback' | 'sheet-alias-hit' | 'header-map';

export interface PendingPayload {
  type: PendingType;
  requested?: string;
  resolved?: string;
  spreadsheet_id?: string;
  route?: string;
  extra?: string | Record<string, unknown>;
}

function getDefaultSpreadsheetId(): string | undefined {
  return process.env.SHEETS_ID || process.env.SPREADSHEET_ID;
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
      if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        throw new Error('GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is not set.');
      }
      const auth = new google.auth.JWT({
        email: GOOGLE_CLIENT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const httpAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
      google.options({ auth, httpAgent });
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return sheetsClientPromise;
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

async function ensurePendingSheet(spreadsheetId: string): Promise<void> {
  const sheets = await getSheetsClient();
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
          'ts_iso',
          'date_local',
          'type',
          'requested',
          'resolved',
          'spreadsheet_id',
          'route',
          'extra',
        ]],
      },
    });
  }
}

function dedupeKey(row: {
  date_local: string;
  type: string;
  requested?: string;
  resolved?: string;
}): string {
  return [
    row.date_local,
    row.type,
    (row.requested || '').toLowerCase(),
    (row.resolved || '').toLowerCase(),
  ].join('|');
}

export async function recordPending(payload: PendingPayload): Promise<void> {
  try {
    const spreadsheetId = payload.spreadsheet_id || getDefaultSpreadsheetId();
    if (!spreadsheetId) return;

    await ensurePendingSheet(spreadsheetId);

    const row = {
      ts_iso: new Date().toISOString(),
      date_local: todayLocalISO(),
      type: payload.type,
      requested: payload.requested || '',
      resolved: payload.resolved || '',
      spreadsheet_id: spreadsheetId,
      route: payload.route || '',
      extra: payload.extra
        ? typeof payload.extra === 'string'
          ? payload.extra
          : JSON.stringify(payload.extra)
        : '',
    };

    const key = dedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);

    const sheets = await getSheetsClient();
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
          row.extra,
        ]],
      },
    });
  } catch (err) {
    console.warn('[techdebt:recordPending:error]', err instanceof Error ? err.message : err);
  }
}
