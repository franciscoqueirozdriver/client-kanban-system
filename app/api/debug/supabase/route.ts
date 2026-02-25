import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const debugInfo = {
    url: {
      exists: !!url,
      startsWithHttps: url?.startsWith('https://'),
      endsWithSupabaseCo: url?.endsWith('.supabase.co'),
    },
    serviceRoleKey: {
      exists: !!serviceRoleKey,
      length: serviceRoleKey?.length || 0,
      isJwt: serviceRoleKey?.split('.').length === 3,
      prefix: serviceRoleKey ? `${serviceRoleKey.substring(0, 10)}...` : null,
      suffix: serviceRoleKey ? `...${serviceRoleKey.substring(serviceRoleKey.length - 10)}` : null,
    },
    anonKey: {
      exists: !!anonKey,
      length: anonKey?.length || 0,
      isJwt: anonKey?.split('.').length === 3,
      prefix: anonKey ? `${anonKey.substring(0, 10)}...` : null,
      suffix: anonKey ? `...${anonKey.substring(anonKey.length - 10)}` : null,
    },
    environmentVariables: Object.keys(process.env).sort(),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(debugInfo);
}
