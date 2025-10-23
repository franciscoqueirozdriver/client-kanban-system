let pool: any | null = null;

async function getPool() {
  if (pool) return pool;
  const { Pool } = await import('pg');
  pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export async function query<T = any>(text: string, params?: any[]) {
  const p = await getPool();
  const client = await p.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}
