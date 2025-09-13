const int = (v, d) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : d;
const MAX = int(process.env.RATE_LIMIT_MAX_ATTEMPTS, 5);
const WIN = int(process.env.RATE_LIMIT_WINDOW_MIN, 15) * 60 * 1000;
const LOCK = int(process.env.LOCKOUT_MIN, 20);

const buckets = new Map(); // key: ip|email -> {count, resetAt}

/**
 * NOTE: The user's spec for this file does not include canAttempt.
 * The `authorize` function was simplified to not need it directly.
 * I am keeping the file name and the core logic as requested.
 * The original canAttempt, if needed, can be reconstructed from this.
 */

export async function registerFailure(req, email) {
  const ip = (req?.headers?.get?.('x-forwarded-for') || '').split(',')[0] || '0.0.0.0';
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
  const ip = (req?.headers?.get?.('x-forwarded-for') || '').split(',')[0] || '0.0.0.0';
  buckets.delete(`${ip}|${email}`);
}

// Exporting constants as requested
export { MAX as RATE_LIMIT_MAX, WIN as RATE_LIMIT_WINDOW_MS, LOCK as LOCKOUT_MINUTES };
