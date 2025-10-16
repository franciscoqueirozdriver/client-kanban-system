// --- Core Normalization ---

export function toDigits(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/\D+/g, "");
}

// Returns "" for empty; otherwise, 14 digits with leading zeros.
export function normalizeCNPJ(v: string | number | null | undefined): string {
  const d = toDigits(v);
  if (!d) return "";
  return d.padStart(14, "0").slice(-14);
}

// --- Formatting ---

// Formats to 00.000.000/0000-00
export function formatCNPJ(v: string | null | undefined): string {
  const d = normalizeCNPJ(v);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// --- Validation ---

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

export const isValidCNPJ = (v: string | number | null | undefined): boolean => {
  const c = normalizeCNPJ(v);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // Check for repeated digits

  const d1 = calcVerifier(c.slice(0, 12));
  const d2 = calcVerifier(c.slice(0, 12) + d1);
  return c.endsWith(String(d1) + String(d2));
};

// --- Legacy Compatibility (to be removed gradually) ---
// @deprecated use toDigits
export const onlyDigits = toDigits;
// @deprecated use formatCNPJ
export const formatCnpj = formatCNPJ;
// @deprecated use normalizeCNPJ
export const padCNPJ14 = normalizeCNPJ;
// @deprecated use isValidCNPJ
export const isCnpj = isValidCNPJ;

// --- Additional compatibility helpers ---

export const normalizeCnpj = normalizeCNPJ;
export const ensureValidCnpj = normalizeCNPJ;
export const isEmptyCNPJLike = (v: string | number | null | undefined): boolean =>
  toDigits(v).length === 0;
