export function isValidCNPJ(input: string) {
  const cnpj = String(input || '').replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDV = (base: string) => {
    let sum = 0;
    let pos = base.length - 7;
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
