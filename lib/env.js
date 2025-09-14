export function requireEnv(keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) throw new Error("Missing env: " + missing.join(", "));
}
export function normalizedGoogleKey() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || "";
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}
