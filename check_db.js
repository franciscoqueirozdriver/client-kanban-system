const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', res.rows.map(r => r.table_name).join(', '));

  // Add column if missing
  try {
    await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade_estimada TEXT;");
    console.log('Column cidade_estimada added to leads (if not existed)');
  } catch (e) {
    console.error('Error adding column to leads:', e.message);
  }

  await client.end();
}
run();
