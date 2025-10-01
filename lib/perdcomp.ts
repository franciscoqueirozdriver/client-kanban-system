// lib/perdcomp.ts - Utilitários para decodificação e análise de códigos PER/DCOMP

export type Familia = 'DCOMP' | 'REST' | 'RESSARC' | 'CANC' | 'DESCONHECIDO';

export interface PerdcompParsed {
  valido: boolean;
  formatted?: string;
  dataISO?: string;
  bloco4?: number; // Tipo de documento
  natureza?: string; // 1.0 a 1.9
  credito?: string; // 01 a 99
  sequencia?: string;
  controle?: string;
  protocolo?: string;
}

export interface PerdcompEnriquecido extends PerdcompParsed {
  tipoDocumento?: string;
  familiaDocumento?: Familia;
  descricaoCredito?: string;
  nivelRisco?: 'BAIXO' | 'MEDIO' | 'ALTO';
  categoria?: string;
  recomendacao?: string;
  oportunidade?: string;
}

// Formatação do código PER/DCOMP
export function formatPerdcomp(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length !== 24) return raw;
  
  const b1 = d.slice(0, 5);   // Sequência
  const b2 = d.slice(5, 10);  // Controle
  const b3 = d.slice(10, 16); // Data DDMMAA
  const b4 = d.slice(16, 17); // Tipo
  const b5 = d.slice(17, 18); // Natureza
  const b6 = d.slice(18, 20); // Crédito
  const suf = d.slice(20, 24); // Protocolo
  
  return `${b1}.${b2}.${b3}.${b4}.${b5}.${b6}-${suf}`;
}

// Parse completo do código PER/DCOMP
export function parsePerdcomp(raw: string): PerdcompParsed {
  const formatted = formatPerdcomp(raw);
  const match = formatted.match(/^(\d{5})\.(\d{5})\.(\d{6})\.(\d)\.(\d)\.(\d{2})-(\d{4})$/);
  
  if (!match) {
    return { valido: false };
  }
  
  const [, sequencia, controle, ddmmaa, tipoStr, natDigit, credito, protocolo] = match;
  
  // Conversão da data
  const dd = ddmmaa.slice(0, 2);
  const mm = ddmmaa.slice(2, 4);
  const aa = ddmmaa.slice(4, 6);
  const dataISO = `${2000 + Number(aa)}-${mm}-${dd}`;
  
  const tipoNum = Number(tipoStr);
  const natureza = `1.${natDigit}`;
  
  return {
    valido: true,
    formatted,
    dataISO,
    bloco4: tipoNum,
    natureza,
    credito,
    sequencia,
    controle,
    protocolo
  };
}

// Mapeamentos de tipos de documento (Bloco 4)
export const TIPOS_DOCUMENTO: Record<number, { nome: string; desc: string }> = {
  1: { nome: 'DCOMP', desc: 'Declaração de Compensação' },
  2: { nome: 'REST', desc: 'Pedido de Restituição' },
  8: { nome: 'CANC', desc: 'Pedido de Cancelamento' },
};

// Mapeamentos de natureza para família (Bloco 5)
export const NATUREZA_FAMILIA: Record<string, Familia> = {
  '1.0': 'DCOMP',
  '1.1': 'RESSARC',
  '1.2': 'REST',
  '1.3': 'DCOMP',
  '1.5': 'RESSARC',
  '1.6': 'REST',
  '1.7': 'DCOMP',
  '1.8': 'CANC',
  '1.9': 'DCOMP',
};

// Observações específicas por natureza
export const NATUREZA_OBSERVACOES: Record<string, string> = {
  '1.0': 'Ressarcimento de IPI',
  '1.1': 'Pedido de Ressarcimento (genérico)',
  '1.2': 'Pedido de Restituição',
  '1.3': 'Declaração de Compensação (geral)',
  '1.5': 'Pedido de Ressarcimento (IPI, etc.)',
  '1.6': 'Pedido de Restituição',
  '1.7': 'Declaração de Compensação',
  '1.8': 'Pedido de Cancelamento',
  '1.9': 'Cofins Não-Cumulativa – Ressarcimento/Compensação',
};

// Descrições dos códigos de crédito (Bloco 6)
export const CREDITOS_DESCRICAO: Record<string, string> = {
  '01': 'Ressarcimento de IPI',
  '02': 'Saldo Negativo de IRPJ',
  '03': 'Outros Créditos',
  '04': 'Pagamento indevido ou a maior',
  '15': 'Retenção – Lei nº 9.711/98',
  '16': 'Outros Créditos (Cancelamento)',
  '17': 'Reintegra',
  '18': 'Outros Créditos',
  '19': 'Cofins Não-Cumulativa – Ressarcimento/Compensação',
  '24': 'Pagamento Indevido ou a Maior (eSocial)',
  '25': 'Outros Créditos',
  '57': 'Outros Créditos',
};

// Categorização por tipo de tributo
export const CREDITO_CATEGORIA: Record<string, string> = {
  '01': 'IPI',
  '02': 'IRPJ',
  '15': 'Retenções',
  '17': 'Incentivos Fiscais',
  '19': 'PIS/Cofins',
  '24': 'eSocial',
  '03': 'Genérico',
  '16': 'Genérico',
  '18': 'Genérico',
  '25': 'Genérico',
  '57': 'Genérico',
};

// Análise de risco por código
export const CREDITO_RISCO: Record<string, 'BAIXO' | 'MEDIO' | 'ALTO'> = {
  '01': 'BAIXO',   // IPI - bem definido
  '02': 'BAIXO',   // IRPJ - bem definido
  '15': 'BAIXO',   // Retenções - bem definido
  '17': 'BAIXO',   // Reintegra - bem definido
  '19': 'BAIXO',   // Cofins NC - bem definido
  '24': 'MEDIO',   // eSocial - relativamente novo
  '03': 'ALTO',    // Outros Créditos - genérico
  '16': 'ALTO',    // Outros Créditos - genérico
  '18': 'ALTO',    // Outros Créditos - genérico
  '25': 'ALTO',    // Outros Créditos - genérico
  '57': 'ALTO',    // Outros Créditos - genérico
};

// Recomendações estratégicas por código
export const CREDITO_RECOMENDACOES: Record<string, string> = {
  '01': 'Verificar se todos os créditos de IPI estão sendo aproveitados adequadamente',
  '02': 'Analisar estratégias de compensação de saldo negativo de IRPJ',
  '15': 'Revisar retenções na fonte para otimização de fluxo de caixa',
  '17': 'Maximizar aproveitamento do Reintegra para exportações',
  '19': 'Verificar cálculo correto de Cofins não-cumulativa',
  '24': 'Revisar contribuições eSocial para identificar pagamentos indevidos',
  '03': 'ATENÇÃO: Código genérico - requer auditoria detalhada para classificação adequada',
  '16': 'ATENÇÃO: Código genérico - verificar motivo específico do cancelamento',
  '18': 'ATENÇÃO: Código genérico - requer análise técnica para identificação do crédito',
  '25': 'ATENÇÃO: Código genérico - necessária revisão para classificação correta',
  '57': 'ATENÇÃO: Código genérico - requer auditoria para determinação da natureza',
};

// Oportunidades por categoria
export const CREDITO_OPORTUNIDADES: Record<string, string> = {
  'IPI': 'Revisão de classificação fiscal de produtos e aproveitamento de créditos de insumos',
  'IRPJ': 'Planejamento tributário para otimização de compensações',
  'Retenções': 'Gestão de fluxo de caixa e recuperação de retenções excessivas',
  'Incentivos Fiscais': 'Maximização de benefícios fiscais disponíveis',
  'PIS/Cofins': 'Otimização do regime não-cumulativo e aproveitamento de créditos',
  'eSocial': 'Revisão de folha de pagamento e contribuições previdenciárias',
  'Genérico': 'Auditoria técnica necessária para identificação de oportunidades específicas',
};

// Função principal para enriquecimento completo
export function enriquecerPerdcomp(raw: string, dadosAPI?: any): PerdcompEnriquecido {
  const parsed = parsePerdcomp(raw);
  
  if (!parsed.valido) {
    return { ...parsed };
  }
  
  const tipo = TIPOS_DOCUMENTO[parsed.bloco4!];
  const familia = NATUREZA_FAMILIA[parsed.natureza!] || 'DESCONHECIDO';
  const descricaoCredito = CREDITOS_DESCRICAO[parsed.credito!] || dadosAPI?.tipo_credito || 'Não identificado';
  const categoria = CREDITO_CATEGORIA[parsed.credito!] || 'Genérico';
  const nivelRisco = CREDITO_RISCO[parsed.credito!] || 'ALTO';
  const recomendacao = CREDITO_RECOMENDACOES[parsed.credito!] || 'Requer análise técnica específica';
  const oportunidade = CREDITO_OPORTUNIDADES[categoria] || 'Análise caso a caso necessária';
  
  return {
    ...parsed,
    tipoDocumento: tipo?.desc || dadosAPI?.tipo_documento || 'Não identificado',
    familiaDocumento: familia,
    descricaoCredito,
    nivelRisco,
    categoria,
    recomendacao,
    oportunidade,
  };
}

// Função para análise agregada de múltiplos PER/DCOMP
export function analisarPortfolioPerdcomp(perdcomps: string[]): {
  totalRegistros: number;
  distribuicaoPorTipo: Record<string, number>;
  distribuicaoPorCategoria: Record<string, number>;
  nivelRiscoGeral: 'BAIXO' | 'MEDIO' | 'ALTO';
  recomendacoesPrioritarias: string[];
  oportunidadesIdentificadas: string[];
} {
  const analises = perdcomps.map(p => enriquecerPerdcomp(p));
  const validos = analises.filter(a => a.valido);
  
  const distribuicaoPorTipo: Record<string, number> = {};
  const distribuicaoPorCategoria: Record<string, number> = {};
  const riscos: string[] = [];
  const recomendacoes = new Set<string>();
  const oportunidades = new Set<string>();
  
  validos.forEach(analise => {
    // Distribuição por tipo
    const tipo = analise.tipoDocumento || 'Não identificado';
    distribuicaoPorTipo[tipo] = (distribuicaoPorTipo[tipo] || 0) + 1;
    
    // Distribuição por categoria
    const categoria = analise.categoria || 'Genérico';
    distribuicaoPorCategoria[categoria] = (distribuicaoPorCategoria[categoria] || 0) + 1;
    
    // Coleta de riscos
    if (analise.nivelRisco) {
      riscos.push(analise.nivelRisco);
    }
    
    // Coleta de recomendações e oportunidades
    if (analise.recomendacao) {
      recomendacoes.add(analise.recomendacao);
    }
    if (analise.oportunidade) {
      oportunidades.add(analise.oportunidade);
    }
  });
  
  // Cálculo do risco geral
  const riscosAltos = riscos.filter(r => r === 'ALTO').length;
  const riscosMedios = riscos.filter(r => r === 'MEDIO').length;
  
  let nivelRiscoGeral: 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO';
  if (riscosAltos > validos.length * 0.3) {
    nivelRiscoGeral = 'ALTO';
  } else if (riscosMedios + riscosAltos > validos.length * 0.2) {
    nivelRiscoGeral = 'MEDIO';
  }
  
  return {
    totalRegistros: validos.length,
    distribuicaoPorTipo,
    distribuicaoPorCategoria,
    nivelRiscoGeral,
    recomendacoesPrioritarias: Array.from(recomendacoes).slice(0, 5),
    oportunidadesIdentificadas: Array.from(oportunidades).slice(0, 5),
  };
}
