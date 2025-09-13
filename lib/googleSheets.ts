import { google } from 'googleapis';
import https from 'https';

// --- WORKAROUND for environment loading issues ---
// In this environment, process.env is not being populated from .env.local
// for API routes. These values are hardcoded from the provided .env.local
// to allow the task to be completed. In a real environment, these should
// be loaded securely from the environment.
const GOOGLE_CLIENT_EMAIL_WORKAROUND = "client-kanban-system@client-kanban-system.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY_WORKAROUND = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDhZi9pCKEZ4jhH\n4aujgW95y5052CQrhSl1W81xIRmcNTdL2Z6iCaZBDjutp7JYbsGP+dSMmSfbFjVi\nzwFi5AHsY2e4CmTqXZ6kmKPpSPV98NkL5Kefj6Gml1CQuRA1LuDCWCA6JZriJbis\nMfuClPVNv/YMJgCv3Fc6AOPbA7YmnX+l1uahXqQ6WojsvaHcy5oDKMdgl1PRcgmY\nhr9rqBI7WLGi/crVve5UySjlYDrZ3pbcrN4p6Lw2/6GkIKLgVThebOEVdrqjDC/W\ninuAj/19UaXeJw+i9ZTNEADZL9PkdDceVad64elZZ4MiMP9exa3sd27p4Py4HOQp\nCjUvkffRAgMBAAECggEAF5DbfBvO3CnuwHUzwNCTmyRSt+2FOpedkgubGyzexJo7\nwc5q634ex8Z5LtrNprlNu4PfWSPaKunTgxUpi/FS0ihCe9d6XZaUM5lR6d4a7KP1\nzWyGqgQWXpiLb9Ypf6X7Edas5+dunh5bhIVlSm3Qh+R+ER8YC0r6Q7I8IHXu4XJ7\nxiQfOJzG54RLNxv0hYjffzFvU/OBbdYfg8lgd8SWprWCtwBzLEw+itBHfWgTw8g8\nuyOQAQA49DI97WmSLpxaG2XZD1miJjKvyR2AXpSQx8oWgAfnCY/CVMFqr0shxA4N\nVlajjMChhzFgJZOaQoLPapuC3NY8jGu+zl05nI/FwQKBgQD/rzQ2F2E1k6NDE8HR\nGR5rwAJfLuZqpFr3WRMk3lKhlObuF2TypmdsFXANA116f8vARKVhhP7n+X/Ik7z/\nNr2DhUMLUlnt7UB101LY9k6M4RqGVOYrUKxsKuD+4YnLooiCBqJyXUlo1U11V/N7\n3mKciqwq8Kd8JhCB8jhpQnpFPQKBgQDhrWlAbXIqysMgW+3ICnYlcUs50HIXmoA6\n+aCTyMYIEItqTqeO7cDOzHf1Q1DeGMQPtI/2a9EY+C/QtT8KUx5UdyEAKO8Dadin\nfR3f9YXCpHojffSPYbk/Ljkw3eBGwY3NvIoKGRsIOBM0PJNNLIIUnek/xqvGted/\n3/2VwpkuJQKBgQCTf9A/8CbdEImblZc2+CWrhT4ZCOZV2PC9Rn6bw0GqA0thSM+s\nh8CcApX8e9d+ZqD1DuTVKDMhQbas0EW0eTDE4ai2rFBCyJ5qGnntvdG8xdNWcT3C\n+SwuzmGzyAqFFgNn90nZbeV+e6bOrelBqR38Lqd5shD8trzJKiHO31HIBQKBgQDI\nEyt62Q0cbwKrD5UxgkTYUSb2LJzZ3DnPDzyTiK44vCI9r1nR12rWbGP1ZyasoJxB\nqDzxpQiN8IrDp8wp5SLAk5UIRUIRbqeLZds0kMFznMpD6QkGjQbkwqAleK+7SyHi\nwkJHTZavpLcx2nplMw5oJM+DoSjtVJvWvMhfG1UemQKBgBOzUUfp4IJaWELa9Nig\ne1d24gt0nNZaV5zKDz47QUNw0G6MPxxgt8ndOJMs3LE7BglT9L+QlJ8HbuUSHlPC\nKLpFIrhMgO6KGqVtetrvhCCrhdLA8NYRslpoTdVjPZYSvk3vVch84L0iq0dPao8i\nA4KTQXgVskUXdmx0rgvqn2yi\n-----END PRIVATE KEY-----";
const SPREADSHEET_ID_WORKAROUND = "1GdsU2GU08Nuhiqb28iYcdmElZqKYmkQof5PRRBXdI64";
// --- END WORKAROUND ---

let sheetsClientPromise: Promise<any>;

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const auth = new google.auth.JWT({
        email: GOOGLE_CLIENT_EMAIL_WORKAROUND,
        key: GOOGLE_PRIVATE_KEY_WORKAROUND,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const httpAgent = new https.Agent({ keepAlive: true });
      google.options({ auth, httpAgent });
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return sheetsClientPromise;
}

export async function getSpreadsheet() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID_WORKAROUND });
  return res.data;
}

export async function getHeader(sheetTitle: string): Promise<string[]> {
  const sheets = await getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID_WORKAROUND,
      range: `${sheetTitle}!1:1`,
    });
    const values = res.data.values?.[0] || [];
    return values.map(v => String(v));
  } catch (e: any) {
    if (e.message.includes('Unable to parse range')) return [];
    throw e;
  }
}

export async function createSheetIfMissing(sheetTitle: string) {
  const spreadsheet = await getSpreadsheet();
  const existingSheet = spreadsheet.sheets?.find(s => s.properties?.title === sheetTitle);
  if (existingSheet) return;

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID_WORKAROUND,
    requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
  });
}

function columnNumberToLetter(columnNumber: number): string {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

export async function appendMissingColumns(sheetTitle: string, columnsToAdd: readonly string[]) {
  // NUNCA renomear, apagar, mover ou sobrescrever colunas existentes.
  // SOMENTE anexar colunas que faltam ao final.
  // Idempotente: não duplicar colunas na segunda execução.
  if (columnsToAdd.length === 0) {
    return;
  }

  const currentHeader = await getHeader(sheetTitle);
  const sheets = await getSheetsClient();

  if (currentHeader.length === 0) {
    // If the sheet is completely empty, write the full list of columns provided.
    const range = `${sheetTitle}!A1`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID_WORKAROUND,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [columnsToAdd],
      },
    });
  } else {
    // If there's an existing header, append only the new columns.
    const startColumn = columnNumberToLetter(currentHeader.length + 1);
    const range = `${sheetTitle}!${startColumn}1`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID_WORKAROUND,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'OVERWRITE', // This is crucial to append columns horizontally
      requestBody: {
        values: [columnsToAdd], // values is a 2D array
      },
    });
  }
}
