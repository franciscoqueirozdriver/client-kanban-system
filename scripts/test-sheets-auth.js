const { google } = require('googleapis');
require('dotenv').config();

const email = process.env.GOOGLE_CLIENT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

async function test() {
  try {
    console.log('Testando autenticação com:', email);
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: process.env.SPREADSHEET_ID
    });
    console.log('✅ Sucesso! Título da planilha:', res.data.properties.title);
  } catch (err) {
    console.error('❌ Erro na autenticação:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

test();
