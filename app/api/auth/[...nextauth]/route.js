export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import authOptions from "@/lib/auth/options";

const nextAuthHandler = NextAuth(authOptions);

// Wrappers com try/catch para evitar 500 e redirecionar ao /login quando algo der ruim
export async function GET(req, ctx) {
  try {
    return await nextAuthHandler(req, ctx);
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
    return await nextAuthHandler(req, ctx);
  } catch (e) {
    console.error("Auth POST error:", e);
    return new Response(JSON.stringify({ error: "auth_internal_error" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
