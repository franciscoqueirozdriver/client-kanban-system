export const onlyDigits = (v?: string) => (v ?? '').replace(/\D/g, '');
const is14 = (d: string) => /^\d{14}$/.test(d);
export const ordem = (cnpj: string) => {
  const d = onlyDigits(cnpj);
  return d.length >= 12 ? d.slice(8, 12) : '';
};
export const isMatriz = (cnpj: string) => ordem(cnpj) === '0001';
export const isFilial = (cnpj: string) => {
  const d = onlyDigits(cnpj);
  return is14(d) && ordem(d) !== '0001';
};
export const isEmptyCNPJLike = (v?: string) => {
  const d = onlyDigits(v);
  return d.length === 0 || /^0+$/.test(d);
};

// cálculo oficial dos DVs (mód 11)
function calcDVs(base12: string) {
  const n = base12.split('').map(Number);
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const s1 = n.reduce((a,x,i)=>a+x*w1[i],0), r1 = s1%11, dv1 = r1<2?0:11-r1;
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const n13 = [...n,dv1];
  const s2 = n13.reduce((a,x,i)=>a+x*w2[i],0), r2 = s2%11, dv2 = r2<2?0:11-r2;
  return `${dv1}${dv2}`;
}
export const toMatrizCNPJ = (cnpj: string) => {
  const d = onlyDigits(cnpj);
  if (d.length < 12) return d;
  const raiz8 = d.slice(0, 8);
  const base12 = `${raiz8}0001`;
  return `${base12}${calcDVs(base12)}`;
};
