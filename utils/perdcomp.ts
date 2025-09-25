export type PerdcompFamilia = 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';

export interface PerdcompParsed {
  valido: boolean;
  raw: string;
  formatted?: string;
  b1?: string;
  b2?: string;
  dataDDMMAA?: string;
  tipoNum?: number;
  natureza?: string; // '1.x'
  familia?: PerdcompFamilia;
  credito?: string; // '01'..'99'
  protocolo?: string;
  dataISO?: string;  // 'YYYY-MM-DD'
}

export function formatPerdcompNumero(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  // PER/DCOMP "compacto": 24 dígitos = 5+5+6+1+1+2+4
  // The user mentioned 27 digits, but all examples and specs point to 24.
  // I will stick to the 24-digit logic from the previous implementation as it matches the regex.
  if (digits.length === 24) {
    const b1 = digits.slice(0, 5);
    const b2 = digits.slice(5, 10);
    const b3 = digits.slice(10, 16);
    const b4 = digits.slice(16, 17);
    const b5 = digits.slice(17, 18);
    const b6 = digits.slice(18, 20);
    const suf = digits.slice(20, 24);
    return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
  }
  return raw ?? '';
}

export function parsePerdcompNumero(raw: string): PerdcompParsed {
  if (!raw) return { valido: false, raw };

  const formatted = formatPerdcompNumero(raw);
  const rx = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d{1,2})\.(\d{2})-(\d{4})$/;
  const m = formatted.match(rx);

  if (!m) {
      // Fallback for the old regex, just in case.
      const old_rx = /^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/;
      const old_m = formatted.match(old_rx);
      if (!old_m) return { valido: false, raw, formatted };

      const [, b1, b2, ddmmaa, tipoStr, natDigit, credito, protocolo] = old_m;
      const tipoNum = Number(tipoStr);
      const natureza = `1.${natDigit}`;
      const familia = NATUREZA_TO_FAMILIA[natureza] ?? 'DESCONHECIDO';
      const dd = ddmmaa.slice(0, 2);
      const mm = ddmmaa.slice(2, 4);
      const aa = ddmmaa.slice(4, 6);
      const ano = 2000 + Number(aa);
      const dataISO = `${ano}-${mm}-${dd}`;

      return {
          valido: true, raw, formatted, b1, b2, dataDDMMAA: ddmmaa, tipoNum,
          natureza, familia, credito, protocolo, dataISO,
      };
  }

  const [, b1, b2, ddmmaa, tipoStr, natDigit, credito, protocolo] = m;

  const tipoNum = Number(tipoStr);
  const naturezaNum = Number(natDigit);

  // Bloco 5 can be tricky. The spec says 1.x, but also 1.0, 1.9, etc.
  // This logic handles both single digit `x` and double-digit `xx` from `1.xx`
  const natureza = naturezaNum < 10 ? `1.${naturezaNum}` : `1${naturezaNum}`;

  const familia = NATUREZA_TO_FAMILIA[natureza] ?? 'DESCONHECIDO';

  const dd = ddmmaa.slice(0, 2);
  const mm = ddmmaa.slice(2, 4);
  const aa = ddmmaa.slice(4, 6);
  const ano = 2000 + Number(aa);
  // Basic sanity check for date parts
  if (Number(dd) > 31 || Number(mm) > 12) {
    return { valido: false, raw, formatted };
  }
  const dataISO = `${ano}-${mm}-${dd}`;

  return {
    valido: true, raw, formatted, b1, b2, dataDDMMAA: ddmmaa, tipoNum,
    natureza, familia, credito, protocolo, dataISO,
  };
}

export type MotivoNormalizado =
  | 'Recepcionado' | 'Deferido' | 'Indeferido'
  | 'Cancelado' | 'Cancelamento negado' | 'Homologado' | 'Outro/Desconhecido';

export function normalizaMotivo(situacao?: string, detalhe?: string): MotivoNormalizado {
  const s = situacao?.toLowerCase() ?? '';
  const d = detalhe?.toLowerCase() ?? '';

  if (s.includes('recepcionado em procedimento de an')) return 'Recepcionado';
  if (s.includes('análise concluída com direito creditório reconhecido')) return 'Deferido';
  if (s.includes('análise concluída com indeferimento')) return 'Indeferido';
  if (s.includes('pedido de cancelamento deferido')) return 'Cancelado';
  if (s.includes('pedido de cancelamento indeferido')) return 'Cancelamento negado';
  if (s.includes('homologado') || s.includes('crédito utilizado')) return 'Homologado';
  if (d.includes('aceito conforme pedido do contribuinte')) return 'Cancelado';

  return 'Outro/Desconhecido';
}

// Mapeamento de Natureza para Família, conforme especificação
export const NATUREZA_TO_FAMILIA: Record<string, PerdcompFamilia> = {
  '1.0': 'DCOMP',
  '1.3': 'DCOMP',
  '1.7': 'DCOMP',
  '1.9': 'DCOMP',
  '1.2': 'REST',
  '1.6': 'REST',
  '1.1': 'RESSARC',
  '1.5': 'RESSARC',
  '1.8': 'CANC',
};

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

export function agregaPerdcomp(
  lista: Array<{ perdcomp: string; situacao?: string; situacao_detalhamento?: string; tipo_credito?: string }>,
  creditosDict: Record<string, string> = {}
): Agregado {
  const initialAgregado: Agregado = {
    total: 0,
    canc: 0,
    totalSemCancelamento: 0,
    porFamilia: { DCOMP: 0, REST: 0, RESSARC: 0, CANC: 0, DESCONHECIDO: 0 },
    porNatureza: {},
    porCredito: {},
    topCreditos: [],
    porMotivo: {
      'Recepcionado': 0, 'Deferido': 0, 'Indeferido': 0,
      'Cancelado': 0, 'Cancelamento negado': 0, 'Homologado': 0, 'Outro/Desconhecido': 0
    },
    cancelamentosLista: [],
  };

  const agregado = (lista ?? []).reduce((acc, item) => {
    const p = parsePerdcompNumero(item.perdcomp);
    if (!p.valido || !p.familia || !p.credito) {
      return acc;
    }

    acc.total++;

    // Contagem por Família
    acc.porFamilia[p.familia] = (acc.porFamilia[p.familia] ?? 0) + 1;

    // Contagem por Natureza
    if (p.natureza) {
        acc.porNatureza[p.natureza] = (acc.porNatureza[p.natureza] ?? 0) + 1;
    }

    // Contagem por Crédito
    acc.porCredito[p.credito] = (acc.porCredito[p.credito] ?? 0) + 1;

    // Contagem por Motivo Normalizado
    const motivo = normalizaMotivo(item.situacao, item.situacao_detalhamento);
    acc.porMotivo[motivo] = (acc.porMotivo[motivo] ?? 0) + 1;

    // Lógica de Cancelamento
    if (p.familia === 'CANC' || motivo === 'Cancelado') {
      acc.canc++;
      if (p.formatted) {
        acc.cancelamentosLista.push(p.formatted);
      }
    }

    return acc;
  }, initialAgregado);

  agregado.totalSemCancelamento = agregado.total - agregado.canc;

  // Calcular Top 3 Créditos
  agregado.topCreditos = Object.entries(agregado.porCredito)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([codigo, quantidade]) => ({
      codigo,
      descricao: creditosDict[codigo] || '(desconhecido)',
      quantidade,
    }));

  return agregado;
}