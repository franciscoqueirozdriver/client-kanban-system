export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const required = ["NEXTAUTH_SECRET", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "SPREADSHEET_ID"];
  const missing = required.filter(k => !process.env[k]);

  const status = missing.length > 0 ? 500 : 200;
  const body = { ok: status === 200, missing };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
