export function digits(value: any): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function onlyDigits(v: any) {
  return digits(v);
}

export function padCNPJ14(v: any) {
  const cleaned = digits(v);
  if (!cleaned) return '';
  return cleaned.length > 14 ? cleaned.slice(-14) : cleaned.padStart(14, '0');
}

export function normalizeDigits(str?: string) {
  return digits(str);
}

export function normalizeCNPJ(value: any) {
  return padCNPJ14(value);
}

export function formatCNPJ(value: any) {
  const normalized = padCNPJ14(value);
  if (normalized.length !== 14) return normalized;
  return normalized.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function isEmptyCNPJLike(value?: string) {
  const digits = normalizeDigits(value);
  return digits.length === 0 || /^0+$/.test(digits);
}

export function isCNPJ14(input?: string) {
  return /^\d{14}$/.test(digits(input));
}

export function isCnpj14(input?: string) {
  return isCNPJ14(input);
}

// Official validation (mod 11). Accepts any input and validates after padStart.
export function isValidCNPJ(input: any) {
  const cnpj = padCNPJ14(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDV = (base: string) => {
    let sum = 0, pos = base.length - 7;
    for (let i = base.length; i >= 1; i--) {
      sum += parseInt(base[base.length - i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return (r < 2) ? 0 : 11 - r;
  };

  const dv1 = calcDV(cnpj.slice(0, 12));
  if (parseInt(cnpj[12], 10) !== dv1) return false;
  const dv2 = calcDV(cnpj.slice(0, 13));
  if (parseInt(cnpj[13], 10) !== dv2) return false;
  return true;
}
