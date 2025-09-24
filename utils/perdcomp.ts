export type PerdcompTipo = 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';

export const DEFAULT_FAMILIA_LABELS: Record<PerdcompTipo, string> = {
  DCOMP: 'DCOMP (Declarações de Compensação)',
  REST: 'REST (Pedidos de Restituição)',
  RESSARC: 'RESSARC (Pedidos de Ressarcimento)',
  CANC: 'Cancelamentos',
  DESCONHECIDO: 'Desconhecido',
};

export type NaturezaInfo = { familia: PerdcompTipo; nome: string };

// TODO: trocar por leitura do dicionário da planilha.
// Fallback mínimo para já funcionar agora.
export const NATUREZA_FALLBACK: Record<string, NaturezaInfo> = {
  '1.3': { familia: 'DCOMP', nome: DEFAULT_FAMILIA_LABELS.DCOMP },
  '1.7': { familia: 'DCOMP', nome: DEFAULT_FAMILIA_LABELS.DCOMP },
  '1.2': { familia: 'REST', nome: DEFAULT_FAMILIA_LABELS.REST },
  '1.6': { familia: 'REST', nome: DEFAULT_FAMILIA_LABELS.REST },
  '1.1': { familia: 'RESSARC', nome: DEFAULT_FAMILIA_LABELS.RESSARC },
  '1.5': { familia: 'RESSARC', nome: DEFAULT_FAMILIA_LABELS.RESSARC },
  '1.8': { familia: 'CANC', nome: DEFAULT_FAMILIA_LABELS.CANC },
  // Outros cairão como desconhecidos até o dicionário ser preenchido
};

export function formatPerdcompNumero(raw: string) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 24) return raw;
  const useDigits = digits.slice(-24);
  const b1 = useDigits.slice(0, 5);
  const b2 = useDigits.slice(5, 10);
  const b3 = useDigits.slice(10, 16);
  const b4 = useDigits.slice(16, 17);
  const b5 = useDigits.slice(17, 18);
  const b6 = useDigits.slice(18, 20);
  const suf = useDigits.slice(20, 24);
  return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
}

export function parsePerdcompNumero(numero: string) {
  const formatted = formatPerdcompNumero(numero);
  const m = formatted.match(/^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, , , , tipoStr, nat1, cred] = m;
  const tipoNum = Number(tipoStr);
  const tipo: PerdcompTipo =
    tipoNum === 1 ? 'DCOMP' : tipoNum === 2 ? 'REST' : tipoNum === 8 ? 'CANC' : 'DESCONHECIDO';
  const natureza = `1.${nat1}`;
  return { formatted, tipo, natureza, credito: cred };
}

export type ResumoPerdcomp = {
  total: number; // bruto
  totalSemCancelamento: number; // para o card
  canc: number;
  breakdown: Array<{ nome: string; familia: PerdcompTipo; quantidade: number }>;
};

export function agregaPerdcomp(lista: Array<{ perdcomp?: string }>): ResumoPerdcomp {
  const porNome = new Map<string, { nome: string; familia: PerdcompTipo; quantidade: number }>();
  let total = 0;
  let canc = 0;

  for (const item of lista ?? []) {
    const numero = item?.perdcomp;
    if (!numero) continue;
    const parsed = parsePerdcompNumero(numero);
    if (!parsed) continue;

    total += 1;

    const info = NATUREZA_FALLBACK[parsed.natureza] ?? {
      familia: parsed.tipo,
      nome: DEFAULT_FAMILIA_LABELS[parsed.tipo] ?? parsed.tipo,
    };

    if (info.familia === 'CANC') {
      canc += 1;
      continue;
    }

    const key = info.nome;
    const atual = porNome.get(key);
    if (atual) {
      atual.quantidade += 1;
    } else {
      porNome.set(key, { nome: info.nome, familia: info.familia, quantidade: 1 });
    }
  }

  const ordemFamilia: Record<PerdcompTipo, number> = {
    DCOMP: 1,
    REST: 2,
    RESSARC: 3,
    DESCONHECIDO: 9,
    CANC: 99,
  };

  const breakdown = Array.from(porNome.values()).sort((a, b) => {
    const ordemA = ordemFamilia[a.familia] !== undefined ? ordemFamilia[a.familia] : 9;
    const ordemB = ordemFamilia[b.familia] !== undefined ? ordemFamilia[b.familia] : 9;
    return ordemA - ordemB;
  });

  const totalSemCancelamento = total - canc;

  return {
    total,
    totalSemCancelamento,
    canc,
    breakdown,
  };
}

export function contaPorFamilia(resumo: ResumoPerdcomp): Record<PerdcompTipo, number> {
  const base: Record<PerdcompTipo, number> = {
    DCOMP: 0,
    REST: 0,
    RESSARC: 0,
    CANC: resumo.canc,
    DESCONHECIDO: 0,
  };

  for (const row of resumo.breakdown) {
    base[row.familia] = (base[row.familia] ?? 0) + row.quantidade;
  }

  return base;
}
