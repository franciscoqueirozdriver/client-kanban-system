// lib/env.js
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} ausente`);
  return v;
}

export const PERPLEXITY = {
  API_KEY: required('PERPLEXITY_API_KEY'),
  ENDPOINT: process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions',
  MODEL: process.env.PERPLEXITY_MODEL || 'sonar',
  TIMEOUT_MS: Number(process.env.PERPLEXITY_TIMEOUT_MS || 10000),
};

export const GOOGLE = {
  CLIENT_EMAIL: required('GOOGLE_CLIENT_EMAIL'),
  // Tratar \n literais quando copiados via painel
  PRIVATE_KEY: required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  SPREADSHEET_ID: required('SPREADSHEET_ID'),
};
