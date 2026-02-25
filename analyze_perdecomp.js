const { google } = require('googleapis');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function run() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!spreadsheetId || !googleClientEmail || !googlePrivateKey) {
    console.error('Missing credentials');
    return;
  }

  const auth = new google.auth.JWT({
    email: googleClientEmail,
    key: googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'perdecomp!A1:ZZ1000', // Read first 1000 rows
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log('No data found');
      return;
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    const candidates = ['perdcomp_id', 'numero_processo', 'url_comprovante_html', 'perdcomp_principal_id', 'cnpj', 'cliente_id'];

    console.log('Total rows:', data.length);
    candidates.forEach(col => {
      if (!headers.includes(col)) {
        console.log(`Column ${col} not found in sheet`);
        return;
      }
      const values = data.map(d => d[col]);
      const nonNullValues = values.filter(v => v !== undefined && v !== '' && v !== null);
      const uniqueValues = new Set(nonNullValues);

      console.log(`Analysis for ${col}:`);
      console.log(`  - Null/Empty: ${data.length - nonNullValues.length}`);
      console.log(`  - Unique: ${uniqueValues.size}`);
      console.log(`  - Total Non-Null: ${nonNullValues.length}`);
      if (uniqueValues.size === nonNullValues.length && nonNullValues.length === data.length) {
        console.log(`  - SUCCESS: Candidate for Primary Key (Unique and No Nulls)`);
      } else if (uniqueValues.size === nonNullValues.length) {
        console.log(`  - UNIQUE but has Nulls`);
      } else {
        console.log(`  - HAS DUPLICATES`);
      }
    });

  } catch (err) {
    console.error('Error reading sheet:', err.message);
  }
}

run();
