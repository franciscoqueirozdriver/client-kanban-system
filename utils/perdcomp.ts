export type PerdcompTipo = 'DCOMP' | 'REST' | 'CANC' | 'DESCONHECIDO';
export type FamiliaTipo = 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';

export function formatPerdcompNumero(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  // PER/DCOMP "compacto": 24 dígitos = 5+5+6+1+1+2+4
  if (digits.length === 24) {
    const b1 = digits.slice(0, 5);   // seq
    const b2 = digits.slice(5, 10);  // controle
    const b3 = digits.slice(10, 16); // data DDMMAA
    const b4 = digits.slice(16, 17); // tipo (1/2/8)
    const b5 = digits.slice(17, 18); // natureza: 1.x → x aqui
    const b6 = digits.slice(18, 20); // crédito
    const suf = digits.slice(20, 24); // protocolo (4)
    return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
  }
  // Se já vier formatado, devolve como está
  return raw ?? '';
}

export function parsePerdcompNumero(raw: string) {
  const formatted = formatPerdcompNumero(raw);
  const rx = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/;
  const m = formatted.match(rx);
  if (!m) return { valido: false as const };

  const [, , , ddmmaa, tipoStr, natDigit, credito, protocolo] = m;

  const tipoNum = Number(tipoStr);
  const tipo: PerdcompTipo =
    tipoNum === 1 ? 'DCOMP' :
    tipoNum === 2 ? 'REST'  :
    tipoNum === 8 ? 'CANC'  :
    'DESCONHECIDO';

  // natureza "1.x" (bloco 5)
  const natureza = `1.${natDigit}`;

  // data ISO (assumindo século 2000–2099)
  const dd = ddmmaa.slice(0, 2);
  const mm = ddmmaa.slice(2, 4);
  const aa = ddmmaa.slice(4, 6);
  const ano = 2000 + Number(aa);
  const dataISO = `${ano}-${mm}-${dd}`;

  return {
    valido: true as const,
    formatted,
    tipo, natureza, credito, protocolo, dataISO,
  };
}

// Natureza (bloco 5) mapeada para a família principal
export const NATUREZA_TO_FAMILIA: Record<string, FamiliaTipo> = {
  '1.1': 'RESSARC',
  '1.5': 'RESSARC',

  '1.2': 'REST',
  '1.6': 'REST',

  '1.3': 'DCOMP',
  '1.7': 'DCOMP',

  '1.8': 'CANC',
};

export function classificaFamiliaPorNatureza(natureza: string): FamiliaTipo {
  return NATUREZA_TO_FAMILIA[natureza] ?? 'DESCONHECIDO';
}

export function agregaPerdcomp(lista: Array<{ perdcomp?: string }>) {
  let total = 0;
  let canc = 0;

  const porFamilia: Record<FamiliaTipo, number> = {
    DCOMP: 0,
    REST: 0,
    RESSARC: 0,
    CANC: 0,
    DESCONHECIDO: 0,
  };

  // Naturezas agrupadas para exibição no card
  const porNaturezaAgrupada: Record<string, number> = {
    '1.3/1.7': 0,
    '1.2/1.6': 0,
    '1.1/1.5': 0,
  };

  for (const it of lista ?? []) {
    const num = it?.perdcomp;
    if (!num) continue;
    const p = parsePerdcompNumero(num);
    if (!p.valido) continue;

    total++;

    const familia = classificaFamiliaPorNatureza(p.natureza);
    porFamilia[familia] = (porFamilia[familia] ?? 0) + 1;

    if (p.natureza === '1.3' || p.natureza === '1.7') {
      porNaturezaAgrupada['1.3/1.7']++;
    }
    if (p.natureza === '1.2' || p.natureza === '1.6') {
      porNaturezaAgrupada['1.2/1.6']++;
    }
    if (p.natureza === '1.1' || p.natureza === '1.5') {
      porNaturezaAgrupada['1.1/1.5']++;
    }

    if (familia === 'CANC') canc++;
  }

  return {
    total,
    totalSemCancelamento: total - canc,
    canc,
    porFamilia,
    porNaturezaAgrupada,
  };
}
