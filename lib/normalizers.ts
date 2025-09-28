/**
 * Pads a number with leading zeros to a specified length.
 * @param n The number to pad.
 * @param len The target length. Defaults to 4.
 * @returns The zero-padded number as a string.
 */
export function zeroPad(n: number, len = 4): string {
  let s = String(n);
  while (s.length < len) {
    s = '0' + s;
  }
  return s;
}

/**
 * Normalizes a CNPJ string to a 14-digit format.
 * 1. Removes all non-digit characters.
 * 2. Returns an empty string if the result is empty.
 * 3. Left-pads with zeros if the length is less than 14.
 * 4. Throws an error if the length is greater than 14, as this indicates a potentially severe data issue.
 *    For retroactive fixing, a different policy (e.g., slicing) can be applied separately.
 * @param raw The raw CNPJ string.
 * @returns The normalized 14-digit CNPJ string.
 * @throws {Error} if the CNPJ contains more than 14 digits after cleaning.
 */
export function normalizeCnpj(raw: any): string {
  if (raw === null || typeof raw === 'undefined') return '';
  const digits = String(raw).replace(/\D/g, '');

  if (digits.length === 0) {
    return '';
  }

  if (digits.length > 14) {
    // For new writes, we enforce a strict policy. The fixer script can have a more lenient policy.
    throw new Error(`Invalid CNPJ: contains more than 14 digits. Value: "${raw}"`);
  }

  return digits.padStart(14, '0');
}

/**
 * Generates a unique Perdcomp_ID with a specific format.
 * Format: PDC-YYYYMMDD-HHMMSS-XXXX
 * - Timestamp is in UTC.
 * - Suffix XXXX is a 4-character, zero-padded, uppercase base-36 random string.
 * @param now The date to use for the timestamp (defaults to current time).
 * @param seed A seed for the random number generator for deterministic results (optional).
 * @returns The generated Perdcomp_ID.
 */
export function generatePerdcompId(now = new Date(), seed?: number): string {
  const year = now.getUTCFullYear();
  const month = zeroPad(now.getUTCMonth() + 1, 2);
  const day = zeroPad(now.getUTCDate(), 2);
  const hours = zeroPad(now.getUTCHours(), 2);
  const minutes = zeroPad(now.getUTCMinutes(), 2);
  const seconds = zeroPad(now.getUTCSeconds(), 2);

  const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;

  const random = seed !== undefined ? seed : Math.random();
  const suffix = Math.floor(random * 36 ** 4).toString(36).toUpperCase().padStart(4, '0');

  return `PDC-${timestamp}-${suffix}`;
}

/**
 * Calculates the next Cliente_ID based on existing IDs.
 * It finds the highest existing number from IDs matching the "CLT-XXXX" format and increments it.
 * @param allClienteIds An array of all existing Cliente_ID strings from the database.
 * @returns The next sequential Cliente_ID (e.g., "CLT-0557").
 */
export async function nextClienteId(fetchAllClienteIds: () => Promise<string[]>): Promise<string> {
    const allIds = await fetchAllClienteIds();
    let maxId = 0;
    const clienteIdRegex = /^CLT-(\d{4})$/;

    for (const id of allIds) {
        if (typeof id === 'string') {
            const match = id.match(clienteIdRegex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) {
                    maxId = num;
                }
            }
        }
    }
    return `CLT-${zeroPad(maxId + 1, 4)}`;
}


// --- Pattern Validators ---

/**
 * Validates if a string matches the canonical Cliente_ID pattern: /^CLT-\d{4}$/
 * @param v The value to validate.
 * @returns True if the pattern matches, false otherwise.
 */
export function isValidClienteIdPattern(v: any): boolean {
  return typeof v === 'string' && /^CLT-\d{4}$/.test(v);
}

/**
 * Validates if a string matches the canonical Perdcomp_ID pattern: /^PDC-\d{8}-\d{6}-[A-Z0-9]{4}$/
 * @param v The value to validate.
 * @returns True if the pattern matches, false otherwise.
 */
export function isValidPerdcompIdPattern(v: any): boolean {
  return typeof v === 'string' && /^PDC-\d{8}-\d{6}-[A-Z0-9]{4}$/.test(v);
}

/**
 * Validates if a string matches the canonical CNPJ pattern: /^\d{14}$/
 * @param v The value to validate.
 * @returns True if the pattern matches, false otherwise.
 */
export function isValidCnpjPattern(v: any): boolean {
  return typeof v === 'string' && /^\d{14}$/.test(v);
}