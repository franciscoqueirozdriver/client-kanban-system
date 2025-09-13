const attempts = new Map();

const RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10) * 60 * 1000;

/**
 * Limpa entradas expiradas do mapa de tentativas.
 * @param {string} key - A chave (ip:email) para verificar.
 * @param {Object} entry - O registro de tentativa associado à chave.
 */
function clearExpiredEntry(key, entry) {
  if (Date.now() - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    attempts.delete(key);
    return true;
  }
  return false;
}

/**
 * Verifica se uma tentativa de login é permitida.
 * @param {string} ip - O endereço de IP da requisição.
 * @param {string} email - O e-mail fornecido na tentativa de login.
 * @returns {{ allowed: boolean, remaining: number, resetAt?: number }}
 */
export function canAttempt(ip, email) {
  const key = `${ip}:${email}`;
  let entry = attempts.get(key);

  if (entry && clearExpiredEntry(key, entry)) {
    entry = undefined; // A entrada expirou e foi removida, então a tratamos como inexistente.
  }

  if (!entry) {
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS };
  }

  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetAt = entry.startTime + RATE_LIMIT_WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - entry.count };
}

/**
 * Registra uma falha de login para a combinação de IP e e-mail.
 * @param {string} ip - O endereço de IP da requisição.
 * @param {string} email - O e-mail fornecido na tentativa de login.
 * @returns {number} O número atual de tentativas de falha.
 */
export function registerFailure(ip, email) {
  const key = `${ip}:${email}`;
  let entry = attempts.get(key);

  if (entry && clearExpiredEntry(key, entry)) {
    entry = undefined; // A entrada expirou, começamos uma nova janela.
  }

  const newCount = (entry?.count || 0) + 1;

  attempts.set(key, {
    count: newCount,
    startTime: entry?.startTime || Date.now(),
  });

  return newCount;
}

/**
 * Registra um sucesso de login, limpando as tentativas para a combinação de IP e e-mail.
 * @param {string} ip - O endereço de IP da requisição.
 * @param {string} email - O e-mail fornecido na tentativa de login.
 */
export function registerSuccess(ip, email) {
  const key = `${ip}:${email}`;
  attempts.delete(key);
}
