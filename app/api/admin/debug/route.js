import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const cookies = req.headers.get('cookie') || '';
  const hasSessionCookie = /next-auth.session-token|__Secure-next-auth.session-token/.test(cookies);
  return NextResponse.json({
    ok: true,
    node: process.versions.node,
    host: req.headers.get('host'),
    hasSessionCookie,
    tokenPresent: !!session,
  });
}
