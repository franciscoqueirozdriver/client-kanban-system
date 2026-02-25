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

  const auth = new google.auth.JWT({
    email: googleClientEmail,
    key: googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'perdecomp!A1:ZZ2',
    });
    console.log(JSON.stringify(response.data.values, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
run();
