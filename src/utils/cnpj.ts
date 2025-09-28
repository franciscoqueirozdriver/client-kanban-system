import { normalizeCnpj as canonicalNormalizeCnpj } from '@/lib/normalizers';

/**
 * @deprecated Use `normalizeCnpj` from `lib/normalizers` instead. This function only extracts digits.
 */
export const onlyDigits = (v: string) => (v ?? '').replace(/\D/g, '');

/**
 * @deprecated Use `normalizeCnpj` from `lib/normalizers` which provides proper padding and validation.
 */
export const normalizeCnpj = (v: string) => canonicalNormalizeCnpj(v);

const calcVerifier = (base: string) => {
  let sum = 0;
  let pos = base.length - 7;
  for (let i = 0; i < base.length; i += 1) {
    sum += Number(base[i]) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }
  const res = sum % 11;
  return res < 2 ? 0 : 11 - res;
};

/**
 * @deprecated Use `isValidCnpjPattern` from `lib/normalizers` for format validation.
 * This function performs full digit validation which may not be desired.
 */
export const isCnpj = (v: string) => {
  let c;
  try {
    // Use the canonical normalizer, but prevent it from throwing
    // so that isCnpj can return a boolean as expected.
    c = canonicalNormalizeCnpj(v);
  } catch (e) {
    return false; // If it's invalid enough to throw, it's not a valid CNPJ.
  }

  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  const d1 = calcVerifier(c.slice(0, 12));
  const d2 = calcVerifier(c.slice(0, 12) + d1);
  return c.endsWith(String(d1) + String(d2));
};

/**
 * @deprecated Use `normalizeCnpj` from `lib/normalizers` and handle exceptions.
 */
export const ensureValidCnpj = (v: string) => {
  const n = normalizeCnpj(v);
  if (!isCnpj(n)) throw new Error('CNPJ inválido');
  return n;
};

/**
 * @deprecated This function is part of the legacy CNPJ utilities.
 */
export const formatCnpj = (v: string) => {
    try {
        return canonicalNormalizeCnpj(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } catch {
        return ''; // Return empty if format is incorrect and throws
    }
}

// --- Compatibility helpers (legacy names) ---

/** @deprecated Use `normalizeCnpj` from `lib/normalizers`. */
export const digits = (value: any) => onlyDigits(String(value ?? ''));

/** @deprecated Use `normalizeCnpj` from `lib/normalizers`. */
export const normalizeDigits = digits;

/** @deprecated Use `normalizeCnpj` from `lib/normalizers`. */
export const normalizeCNPJ = normalizeCnpj;

/** @deprecated Use `normalizeCnpj` from `lib/normalizers`. */
export const padCNPJ14 = (input?: string) => normalizeCnpj(input ?? '');

/** @deprecated This function is part of the legacy CNPJ utilities. */
export const formatCNPJ = formatCnpj;

/** @deprecated Use `isValidCnpjPattern` from `lib/normalizers`. */
export const isCNPJ14 = (input?: string) => isCnpj(String(input ?? ''));

/** @deprecated Use `isValidCnpjPattern` from `lib/normalizers`. */
export const isCnpj14 = isCNPJ14;

/** @deprecated Use `isValidCnpjPattern` from `lib/normalizers`. */
export const isValidCNPJ = (input: any) => isCnpj(String(input ?? ''));

/** @deprecated This function is part of the legacy CNPJ utilities. */
export const isEmptyCNPJLike = (value?: string) => {
  const d = onlyDigits(String(value ?? ''));
  return d.length === 0 || /^0+$/.test(d);
};