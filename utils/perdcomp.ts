export type PerdcompFamilia = 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';

export interface PerdcompParsed {
  valido: boolean;
  raw: string;
  formatted?: string;
  b1?: string;
  b2?: string;
  dataDDMMAA?: string;
  tipoNum?: number;
  natureza?: string;
  familia?: PerdcompFamilia;
  credito?: string;
  protocolo?: string;
  dataISO?: string;
}

const NATUREZA_FAMILIA_MAP: Record<string, PerdcompFamilia> = {
  '1.0': 'DCOMP',
  '1.3': 'DCOMP',
  '1.7': 'DCOMP',
  '1.9': 'DCOMP',
  '1.2': 'REST',
  '1.6': 'REST',
  '1.1': 'RESSARC',
  '1.5': 'RESSARC',
  '1.8': 'CANC'
};

const FAMILIA_DEFAULT_LABELS: Record<PerdcompFamilia, string> = {
  DCOMP: 'DCOMP',
  REST: 'REST',
  RESSARC: 'RESSARC',
  CANC: 'CANC',
  DESCONHECIDO: 'DESCONHECIDO'
};

export function formatPerdcompNumero(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 24) {
    return raw;
  }
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

function inferFamilia(tipoNum?: number, natureza?: string): PerdcompFamilia {
  if (natureza && NATUREZA_FAMILIA_MAP[natureza]) {
    return NATUREZA_FAMILIA_MAP[natureza];
  }
  if (tipoNum === 1) return 'DCOMP';
  if (tipoNum === 2) return 'REST';
  if (tipoNum === 8) return 'CANC';
  return 'DESCONHECIDO';
}

function toISOFromDDMMAA(ddmmaa?: string): string | undefined {
  if (!ddmmaa || ddmmaa.length !== 6) {
    return undefined;
  }
  const dia = Number(ddmmaa.slice(0, 2));
  const mes = Number(ddmmaa.slice(2, 4));
  const ano = Number(ddmmaa.slice(4, 6));
  if (!dia || !mes) {
    return undefined;
  }
  const anoFull = ano >= 70 ? 1900 + ano : 2000 + ano;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${anoFull}-${pad(mes)}-${pad(dia)}`;
}

const REGEX_PERDCOMP = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/;

export function parsePerdcompNumero(raw: string): PerdcompParsed {
  const formatted = formatPerdcompNumero(raw);
  const match = formatted.match(REGEX_PERDCOMP);
  if (!match) {
    return { valido: false, raw };
  }

  const [, b1, b2, b3, tipoStr, natDigit, credito, protocolo] = match;
  const tipoNum = Number(tipoStr);
  const natureza = `1.${natDigit}`;
  const familia = inferFamilia(tipoNum, natureza);
  const dataISO = toISOFromDDMMAA(b3);

  return {
    valido: true,
    raw,
    formatted,
    b1,
    b2,
    dataDDMMAA: b3,
    tipoNum,
    natureza,
    familia,
    credito,
    protocolo,
    dataISO
  };
}

export type MotivoNormalizado =
  | 'Recepcionado'
  | 'Deferido'
  | 'Indeferido'
  | 'Cancelado'
  | 'Cancelamento negado'
  | 'Homologado'
  | 'Outro/Desconhecido';

function normalizeText(value?: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function normalizaMotivo(situacao?: string, detalhe?: string): MotivoNormalizado {
  const s = normalizeText(situacao);
  const d = normalizeText(detalhe);

  if (s.includes('recepcionado em procedimento de análise')) {
    return 'Recepcionado';
  }
  if (s.includes('análise concluída com direito creditório reconhecido')) {
    return 'Deferido';
  }
  if (s.includes('análise concluída com indeferimento')) {
    return 'Indeferido';
  }
  if (s.includes('pedido de cancelamento deferido')) {
    return 'Cancelado';
  }
  if (s.includes('pedido de cancelamento indeferido') || d.includes('indeferido')) {
    return 'Cancelamento negado';
  }
  if (s.includes('homologado') || s.includes('credito utilizado') || d.includes('homologado')) {
    return 'Homologado';
  }

  return 'Outro/Desconhecido';
}

export interface Agregado {
  total: number;
  canc: number;
  totalSemCancelamento: number;
  porFamilia: Record<PerdcompFamilia, number>;
  porNatureza: Record<string, number>;
  porCredito: Record<string, number>;
  topCreditos: Array<{ codigo: string; descricao?: string; quantidade: number }>;
  porMotivo: Record<MotivoNormalizado, number>;
  cancelamentosLista: string[];
}

export interface PerdcompResumo {
  total: number;
  canc: number;
  totalSemCancelamento: number;
  familias: Record<PerdcompFamilia, number>;
  topCreditos: Array<{ codigo: string; descricao?: string; quantidade: number }>;
  situacoes: Record<MotivoNormalizado, number>;
  cancelamentos: string[];
}

const MOTIVOS_BASE: MotivoNormalizado[] = [
  'Recepcionado',
  'Deferido',
  'Indeferido',
  'Cancelado',
  'Cancelamento negado',
  'Homologado',
  'Outro/Desconhecido'
];

const FAMILIAS: PerdcompFamilia[] = ['DCOMP', 'REST', 'RESSARC', 'CANC', 'DESCONHECIDO'];

export function agregaPerdcomp(
  lista: Array<{ perdcomp: string; situacao?: string; situacao_detalhamento?: string; tipo_credito?: string }>,
  creditosDict?: Record<string, string>
): Agregado {
  const porFamilia: Record<PerdcompFamilia, number> = {
    DCOMP: 0,
    REST: 0,
    RESSARC: 0,
    CANC: 0,
    DESCONHECIDO: 0
  };

  const porNatureza: Record<string, number> = {};
  const porCredito: Record<string, number> = {};
  const porMotivo: Record<MotivoNormalizado, number> = MOTIVOS_BASE.reduce((acc, motivo) => {
    acc[motivo] = 0;
    return acc;
  }, {} as Record<MotivoNormalizado, number>);

  const cancelamentosLista: string[] = [];

  let total = 0;

  for (const item of lista ?? []) {
    const numero = item?.perdcomp;
    if (!numero) {
      continue;
    }
    const parsed = parsePerdcompNumero(numero);
    if (!parsed.valido) {
      continue;
    }

    total += 1;

    const familia = parsed.familia ?? 'DESCONHECIDO';
    porFamilia[familia] = (porFamilia[familia] ?? 0) + 1;

    if (parsed.natureza) {
      porNatureza[parsed.natureza] = (porNatureza[parsed.natureza] ?? 0) + 1;
    }

    const codigoCredito = parsed.credito ?? item.tipo_credito;
    if (codigoCredito) {
      const normalized = codigoCredito.padStart(2, '0');
      porCredito[normalized] = (porCredito[normalized] ?? 0) + 1;
    }

    const motivo = normalizaMotivo(item.situacao, item.situacao_detalhamento);
    porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;

    if (familia === 'CANC') {
      cancelamentosLista.push(parsed.formatted ?? formatPerdcompNumero(numero));
    }
  }

  const canc = porFamilia.CANC;
  const totalSemCancelamento = total - canc;

  const topCreditos = Array.from(Object.entries(porCredito))
    .map(([codigo, quantidade]) => ({
      codigo,
      descricao: creditosDict?.[codigo],
      quantidade
    }))
    .sort((a, b) => {
      if (b.quantidade !== a.quantidade) {
        return b.quantidade - a.quantidade;
      }
      return a.codigo.localeCompare(b.codigo);
    })
    .slice(0, 3);

  // Garantir chaves para famílias não vistas (caso o reduce tenha removido)
  for (const familia of FAMILIAS) {
    if (!(familia in porFamilia)) {
      porFamilia[familia] = 0;
    }
  }

  return {
    total,
    canc,
    totalSemCancelamento,
    porFamilia,
    porNatureza,
    porCredito,
    topCreditos,
    porMotivo,
    cancelamentosLista
  };
}

export const DEFAULT_FAMILIA_LABELS: Record<PerdcompFamilia, string> = FAMILIA_DEFAULT_LABELS;

export function toPerdcompResumo(agregado: Agregado): PerdcompResumo {
  return {
    total: agregado.total,
    canc: agregado.canc,
    totalSemCancelamento: agregado.totalSemCancelamento,
    familias: agregado.porFamilia,
    topCreditos: agregado.topCreditos,
    situacoes: agregado.porMotivo,
    cancelamentos: agregado.cancelamentosLista
  };
}
