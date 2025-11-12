/**
 * Cleans, normalizes, and validates a single Brazilian phone number.
 * Returns a string of 12 or 13 digits (55 + DD + number) or null if invalid.
 * @param {string} phone - The phone number string to process.
 * @param {string} defaultDDI - The default DDI to use if not present.
 * @returns {string|null}
 */
function normalizeAndValidatePhone(phone, defaultDDI = '55') {
  if (!phone) return null;

  // 1. Remover tudo que não for dígito
  let digits = String(phone).replace(/\D/g, '');

  // 2. Tratar prefixos internacionais (00)
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // 3. Garantir DDI
  if (digits.startsWith(defaultDDI)) {
    // Already has DDI, do nothing
  } else {
    digits = defaultDDI + digits;
  }

  // 4. Remover o “0” de trunk após o DDI
  if (digits.startsWith(defaultDDI + '0')) {
    digits = defaultDDI + digits.substring(3);
  }

  // 5. Validação mínima de tamanho (55 + DD + 8/9 dígitos)
  if (digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  return null; // Retorna nulo se não for válido
}

/**
 * Takes a string containing one or more phone numbers with various separators,
 * normalizes each one, removes duplicates, and returns a single semicolon-separated string.
 * @param {string} phoneListStr - The string of phone numbers.
 * @returns {string|null}
 */
export function normalizePhoneList(phoneListStr) {
  if (!phoneListStr || typeof phoneListStr !== 'string') return null;

  // Considerar múltiplos separadores
  const parts = phoneListStr.split(/[;,/|\\n]+/g);

  const normalizedPhones = parts
    .map(part => normalizeAndValidatePhone(part.trim())) // Normaliza cada parte
    .filter(Boolean); // Remove nulos (inválidos)

  if (normalizedPhones.length === 0) return null;

  // Remove duplicados e junta com ';'
  const uniquePhones = Array.from(new Set(normalizedPhones));
  return uniquePhones.join(';');
}
