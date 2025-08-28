export function onlyDigits(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

export function padCNPJ14(v: any) {
  return onlyDigits(v).padStart(14, '0');
}

export function normalizeDigits(str?: string) {
  return (str ?? '').replace(/\D/g, '');
}

export function isEmptyCNPJLike(value?: string) {
  const digits = normalizeDigits(value);
  return digits.length === 0 || /^0+$/.test(digits);
}

export function isCNPJ14(digits?: string) {
  return /^\d{14}$/.test(digits ?? '');
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
