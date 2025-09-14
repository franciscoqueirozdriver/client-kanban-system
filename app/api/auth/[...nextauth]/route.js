export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import authOptions from "@/lib/auth/options";

const nextAuthHandler = NextAuth(authOptions);

// Defensive wrapper for the GET handler
export async function GET(req, ctx) {
  try {
    return await nextAuthHandler(req, ctx);
  } catch (e) {
    console.error("Auth GET error:", e);
    // If the handler crashes, redirect to the login page gracefully.
    const url = new URL(req.url);
    const callbackUrl = url.searchParams.get("callbackUrl") || "/";
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", callbackUrl);
    url.searchParams.set("error", "InternalAuthError"); // Add a generic error
    return Response.redirect(url, 302);
  }
}

// Defensive wrapper for the POST handler
export async function POST(req, ctx) {
  try {
    return await nextAuthHandler(req, ctx);
  } catch (e) {
    console.error("Auth POST error:", e);
    // If the handler crashes during a credential submission,
    // return a controlled JSON error instead of a 500 page.
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno no servidor." }), {
      status: 500, // Use 500 as it's a server failure, but the response is controlled.
      headers: { "content-type": "application/json" },
    });
  }
}
