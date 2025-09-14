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
    // Intercept the custom "NO_PASSWORD" error to send a specific response
    if (e.message === "NO_PASSWORD") {
      console.log("Intercepted NO_PASSWORD error, sending custom response.");
      return new Response(JSON.stringify({ error: "NO_PASSWORD" }), {
        status: 403, // 403 Forbidden is more appropriate than 400
        headers: { "content-type": "application/json" },
      });
    }

    console.error("Auth POST error:", e);
    return new Response(JSON.stringify({ error: "auth_internal_error" }), {
      status: 500, // This is a true internal server error
      headers: { "content-type": "application/json" },
    });
  }
}
