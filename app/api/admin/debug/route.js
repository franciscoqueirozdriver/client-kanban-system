import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAdmin = token?.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const cookies = req.headers.get('cookie') || '';
  const hasSessionCookie = /next-auth.session-token|__Secure-next-auth.session-token/.test(cookies);
  return NextResponse.json({
    ok: true,
    node: process.versions.node,
    host: req.headers.get('host'),
    hasSessionCookie,
    tokenPresent: !!token,
  });
}
