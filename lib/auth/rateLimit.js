const int = (v, d) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : d;
const MAX = int(process.env.RATE_LIMIT_MAX_ATTEMPTS, 5);
const WIN = int(process.env.RATE_LIMIT_WINDOW_MIN, 15) * 60 * 1000;
const LOCK = int(process.env.LOCKOUT_MIN, 20);

const buckets = new Map(); // key: ip|email -> {count, resetAt}

/**
 * Extracts the IP address from the request object provided by the NextAuth authorize callback.
 * This object has a plain `headers` object, not a Headers API object with `.get()`.
 * @param {object} req - The request object from the authorize callback.
 * @returns {string} The extracted IP address or a default.
 */
function getIpFromAuthorizeReq(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp;
  }
  // The `socket` object might not exist in all environments, so access it safely.
  return req.socket?.remoteAddress || '0.0.0.0';
}

export async function registerFailure(req, email) {
  const ip = getIpFromAuthorizeReq(req);
  const key = `${ip}|${email}`;
  const now = Date.now();
  const b = buckets.get(key) || { count: 0, resetAt: now + WIN };

  if (now > b.resetAt) { // If window expired, reset counter
    b.count = 0;
    b.resetAt = now + WIN;
  }

  b.count += 1;
  buckets.set(key, b);
}

export async function registerSuccess(req, email) {
  const ip = getIpFromAuthorizeReq(req);
  buckets.delete(`${ip}|${email}`);
}

// Exporting constants as requested by a previous spec, keeping for consistency.
export { MAX as RATE_LIMIT_MAX, WIN as RATE_LIMIT_WINDOW_MS, LOCK as LOCKOUT_MINUTES };
