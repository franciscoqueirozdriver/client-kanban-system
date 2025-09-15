export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import authOptions from "@/lib/auth/options";

const REQUIRED_ENVS = [
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SPREADSHEET_ID",
];

function logRequest(req) {
  const missing = REQUIRED_ENVS.filter((k) => !process.env[k]);
  const runtime = process.env.NEXT_RUNTIME || "node";
  const base = `[auth] method=${req.method} url=${req.url} runtime=${runtime} missing=${missing.join(",")}`;
  if (process.env.VERCEL_ENV === "preview") {
    console.log(`${base} node=${process.versions.node} abi=${process.versions.modules}`);
  } else {
    console.log(base);
  }
}

async function runAuth(req, ctx) {
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}

// Wrappers para que /api/auth/signin nunca exploda 500 e redirecione ao /login
export async function GET(req, ctx) {
  logRequest(req);
  try {
    return await runAuth(req, ctx);
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
  logRequest(req);
  try {
    return await runAuth(req, ctx);
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
