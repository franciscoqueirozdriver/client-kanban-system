export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const required = ["NEXTAUTH_SECRET","GOOGLE_CLIENT_EMAIL","GOOGLE_PRIVATE_KEY","SPREADSHEET_ID"];
  const missing = required.filter(k => !process.env[k]);
  return new Response(JSON.stringify({ ok: missing.length === 0, missing }), {
    status: missing.length ? 500 : 200,
    headers: { "content-type": "application/json" },
  });
}
