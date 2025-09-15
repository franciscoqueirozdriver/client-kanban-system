import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const requiredEnvs = [
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'SPREADSHEET_ID',
  ];

  const missing = requiredEnvs.filter(k => !process.env[k]);

  if (missing.length > 0) {
    console.error('Health check failed. Missing ENVs:', missing);
    return NextResponse.json(
      { ok: false, missing },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, missing: [] });
}
