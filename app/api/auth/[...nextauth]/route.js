export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import authOptions from "@/lib/auth/options";

const handler = NextAuth(authOptions);

// Wrappers para que /api/auth/signin nunca exploda 500 e redirecione ao /login
export async function GET(req, ctx) {
  try {
    return await handler(req, ctx);
  } catch (e) {
    console.error("Auth GET error:", e);
    const url = new URL(req.url);
    const cb = url.searchParams.get("callbackUrl") || "/";
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", cb);
    return Response.redirect(url, 302);
  }
}

export async function POST(req, ctx) {
  try {
    return await handler(req, ctx);
  } catch (e) {
    console.error("Auth POST error:", e);
    return new Response(JSON.stringify({ error: "auth_internal_error" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
