const { Client } = require('pg');
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error('No connection string found in environment variables.');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const queries = [
      "ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade_estimada TEXT;",
      "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade_estimada TEXT;"
    ];

    for (const q of queries) {
      try {
        await client.query(q);
        console.log(`Executed: ${q}`);
      } catch (e) {
        console.error(`Failed: ${q} - ${e.message}`);
      }
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.end();
  }
}
run();
