export type PerdcompTipo = 'DCOMP' | 'REST' | 'CANC' | 'DESCONHECIDO';

export function formatPerdcompNumero(raw: string) {
  const onlyDigits = raw.replace(/\D/g, '');
  if (onlyDigits.length !== 27) return raw;
  const b1 = onlyDigits.slice(0, 5);
  const b2 = onlyDigits.slice(5, 10);
  const b3 = onlyDigits.slice(10, 16);
  const b4 = onlyDigits.slice(16, 17);
  const b5 = onlyDigits.slice(17, 18);
  const b6 = onlyDigits.slice(18, 20);
  const suf = onlyDigits.slice(20, 24);
  return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
}

export function parsePerdcompNumero(numero: string) {
  const formatted = formatPerdcompNumero(numero);
  const rx = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/;
  const m = formatted.match(rx);
  if (!m) return { valido: false, tipo: 'DESCONHECIDO' as PerdcompTipo };

  const [, , , , tipoStr, naturezaParte1] = m;
  const tipoNum = Number(tipoStr);

  const tipo: PerdcompTipo =
    tipoNum === 1 ? 'DCOMP' :
    tipoNum === 2 ? 'REST'  :
    tipoNum === 8 ? 'CANC'  :
    'DESCONHECIDO';

  const natureza = `1.${naturezaParte1}`;
  return { valido: true, tipo, natureza };
}

export function agregaPerdcomp(lista: Array<{ perdcomp: string }>) {
  let total = 0, dcomp = 0, rest = 0, canc = 0;

  for (const item of lista) {
    if (!item?.perdcomp) continue;
    const parsed = parsePerdcompNumero(item.perdcomp);
    if (!parsed.valido) continue;

    total++;
    if (parsed.tipo === 'DCOMP') dcomp++;
    else if (parsed.tipo === 'REST') rest++;
    else if (parsed.tipo === 'CANC') canc++;
  }

  return {
    total,
    totalSemCancelamento: total - canc,
    dcomp,
    rest,
    canc,
  };
}
