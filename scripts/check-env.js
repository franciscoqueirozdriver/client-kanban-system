require('dotenv').config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SPREADSHEET_ID',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY'
];

console.log('--- Verificando Variáveis de Ambiente ---');
required.forEach(key => {
  if (process.env[key]) {
    console.log(`✅ ${key} está configurada.`);
  } else {
    console.log(`❌ ${key} NÃO está configurada.`);
  }
});
