export const onlyDigits = (v: string) => (v ?? '').replace(/\D/g, '');

export const normalizeCnpj = (v: string) => {
  const d = onlyDigits(String(v ?? ''));
  if (!d) return '';
  if (d.length > 14) return d.slice(0, 14);
  return d.padStart(14, '0');
};

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

export const isCnpj = (v: string) => {
  const c = normalizeCnpj(v);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  const d1 = calcVerifier(c.slice(0, 12));
  const d2 = calcVerifier(c.slice(0, 12) + d1);
  return c.endsWith(String(d1) + String(d2));
};

export const ensureValidCnpj = (v: string) => {
  const n = normalizeCnpj(v);
  if (!isCnpj(n)) throw new Error('CNPJ inválido');
  return n;
};

export const formatCnpj = (v: string) =>
  normalizeCnpj(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

// --- Compatibility helpers (legacy names) ---
export const digits = (value: any) => onlyDigits(String(value ?? ''));
export const normalizeDigits = digits;
export const normalizeCNPJ = normalizeCnpj;
export const padCNPJ14 = (input?: string) => normalizeCnpj(input ?? '');
export const formatCNPJ = formatCnpj;
export const isCNPJ14 = (input?: string) => isCnpj(String(input ?? ''));
export const isCnpj14 = isCNPJ14;
export const isValidCNPJ = (input: any) => isCnpj(String(input ?? ''));
export const isEmptyCNPJLike = (value?: string) => {
  const d = onlyDigits(String(value ?? ''));
  return d.length === 0 || /^0+$/.test(d);
};
