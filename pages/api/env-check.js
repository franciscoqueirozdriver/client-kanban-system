// pages/api/env-check.js
export const config = { runtime: 'nodejs' };

const have = (k) => Boolean(process.env[k]);

export default function handler(req, res) {
  // Não expor valores; apenas flags booleanas
  res.status(200).json({
    PERPLEXITY_API_KEY: have('PERPLEXITY_API_KEY'),
    PERPLEXITY_ENDPOINT: have('PERPLEXITY_ENDPOINT'),
    PERPLEXITY_MODEL: have('PERPLEXITY_MODEL'),
    PERPLEXITY_TIMEOUT_MS: have('PERPLEXITY_TIMEOUT_MS'),
    GOOGLE_CLIENT_EMAIL: have('GOOGLE_CLIENT_EMAIL'),
    GOOGLE_PRIVATE_KEY: have('GOOGLE_PRIVATE_KEY'),
    SPREADSHEET_ID: have('SPREADSHEET_ID'),
    runtime: process.env.VERCEL ? 'vercel' : 'local',
  });
}
