export function onlyDigits(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

export function padCNPJ14(v: any) {
  return onlyDigits(v).padStart(14, '0');
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

function calcCnpjDv(base12: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += parseInt(base12[i], 10) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjToHeadquarters(cnpj: string): string {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return digits;
  const raiz = digits.substring(0, 8);
  const base = raiz + '0001'; // 12 dígitos
  const dv1 = calcCnpjDv(base, [5,4,3,2,9,8,7,6,5,4,3,2]);
  const dv2 = calcCnpjDv(base + String(dv1), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return base + String(dv1) + String(dv2);
}

export function isFilial(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  const ordem = digits.substring(8, 12);
  return ordem !== '0001';
}
