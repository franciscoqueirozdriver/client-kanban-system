import { ensureHeaders, HEADERS_BY_SHEET } from './perdcompHeaders';
import { createSheet, getSheetsClient, getSpreadsheetId, sheetExists } from './sheets';

async function migrate(): Promise<void> {
  getSpreadsheetId();

  const sheets = await getSheetsClient();

  for (const [title, headers] of Object.entries(HEADERS_BY_SHEET)) {
    const exists = await sheetExists(title);
    if (!exists) {
      await createSheet(title);
    }

    await ensureHeaders(sheets, title as keyof typeof HEADERS_BY_SHEET, headers);
  }

  console.log('Migração concluída.');
}

migrate().catch((error) => {
  console.error('Erro na migração:', error);
  process.exit(1);
});
