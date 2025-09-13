/**
 * Checks if all required environment variable keys are present.
 * Throws an error if any key is missing.
 * @param {string[]} keys - An array of environment variable key names to check.
 */
export function requireEnv(keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Faltando variáveis de ambiente obrigatórias: ${missing.join(', ')}`);
  }
}

/**
 * Normalizes the GOOGLE_PRIVATE_KEY by replacing literal '\\n' with actual newline characters.
 * This is often necessary when the key is stored as a single-line string.
 * @returns {string} The normalized private key.
 */
export function normalizedGoogleKey() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || '';
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}
