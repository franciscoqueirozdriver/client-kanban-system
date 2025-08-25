export type PerdcompTipo = 'DCOMP' | 'REST' | 'CANC' | 'DESCONHECIDO';

export function formatPerdcompNumero(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 27) {
    const b1 = digits.slice(0, 5);
    const b2 = digits.slice(5, 10);
    const b3 = digits.slice(10, 16); // DDMMAA
    const b4 = digits.slice(16, 17); // tipo
    const b5 = digits.slice(17, 18); // natureza: 1.x -> x aqui
    const b6 = digits.slice(18, 20); // crédito
    const suf = digits.slice(20, 24); // protocolo
    return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
  }
  return raw ?? '';
}

export function parsePerdcompNumero(raw: string) {
  const formatted = formatPerdcompNumero(raw);
  const rx = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/;
  const m = formatted.match(rx);
  if (!m) return { valido: false as const };

  const [, _b1, _b2, ddmmaa, tipoStr, natDigit, credito, protocolo] = m;

  const tipoNum = Number(tipoStr);
  const tipo: PerdcompTipo =
    tipoNum === 1 ? 'DCOMP' :
    tipoNum === 2 ? 'REST'  :
    tipoNum === 8 ? 'CANC'  :
    'DESCONHECIDO';

  const natureza = `1.${natDigit}`;

  const dd = ddmmaa.slice(0, 2);
  const mm = ddmmaa.slice(2, 4);
  const aa = ddmmaa.slice(4, 6);
  const ano = 2000 + Number(aa);
  const dataISO = `${ano}-${mm}-${dd}`;

  return {
    valido: true as const,
    tipo,
    natureza,
    credito,
    protocolo,
    dataISO,
    formatted,
  };
}

export function agregaPerdcomp(lista: Array<{ perdcomp?: string }>) {
  let total = 0, canc = 0;
  const porTipo = { DCOMP: 0, REST: 0, CANC: 0, DESCONHECIDO: 0 };
  const porNatureza: Record<string, number> = {};

  for (const it of (lista ?? [])) {
    const num = it?.perdcomp;
    if (!num) continue;
    const p = parsePerdcompNumero(num);
    if (!p.valido) continue;

    total++;
    porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
    porNatureza[p.natureza] = (porNatureza[p.natureza] ?? 0) + 1;

    if (p.tipo === 'CANC') canc++;
  }

  return {
    total,
    totalSemCancelamento: total - canc,
    porTipo,
    porNatureza,
  };
}
