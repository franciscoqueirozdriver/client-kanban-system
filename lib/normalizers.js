/**
 * @param {number} n
 * @param {number} len
 * @returns {string}
 */
export function zeroPad(n, len = 4) {
  let str = String(n);
  while (str.length < len) {
    str = '0' + str;
  }
  return str;
}

/**
 * @param {() => Promise<string[]>} fetchAllClienteIds
 * @returns {Promise<string>}
 */
export async function nextClienteId(fetchAllClienteIds) {
  const allIds = await fetchAllClienteIds();
  const validIdRegex = /^CLT-(\d{4})$/;
  let maxId = 0;

  for (const id of allIds) {
    if (typeof id === 'string') {
      const match = id.match(validIdRegex);
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

/**
 * @param {Date} [now=new Date()]
 * @param {() => number} [rand=Math.random]
 * @returns {string}
 */
export function generatePerdcompId(now = new Date(), rand = Math.random) {
  const year = now.getFullYear();
  const month = zeroPad(now.getMonth() + 1, 2);
  const day = zeroPad(now.getDate(), 2);
  const hours = zeroPad(now.getHours(), 2);
  const minutes = zeroPad(now.getMinutes(), 2);
  const seconds = zeroPad(now.getSeconds(), 2);

  const suffix = Math.floor(rand() * (36 ** 4)).toString(36).toUpperCase();

  return `PDC-${year}${month}${day}-${hours}${minutes}${seconds}-${zeroPad(suffix, 4)}`;
}

/**
 * @param {any} raw
 * @returns {string}
 */
export function normalizeCnpj(raw) {
  if (raw === null || raw === undefined) {
    return "";
  }
  const digitsOnly = String(raw).replace(/\D/g, '');

  if (digitsOnly.length === 0) {
    return "";
  }

  if (digitsOnly.length < 14) {
    return digitsOnly.padStart(14, '0');
  }

  if (digitsOnly.length > 14) {
    return digitsOnly.slice(-14);
  }

  return digitsOnly;
}

/**
 * @param {any} v
 * @returns {boolean}
 */
export function isValidClienteIdPattern(v) {
  return /^CLT-\d{4}$/.test(v);
}

/**
 * @param {any} v
 * @returns {boolean}
 */
export function isValidPerdcompIdPattern(v) {
  return /^PDC-\d{8}-\d{6}-[A-Z0-9]{4}$/.test(v);
}

/**
 * @param {any} v
 * @returns {boolean}
 */
export function isValidCnpjPattern(v) {
  return /^\d{14}$/.test(v);
}