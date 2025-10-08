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

// Recomendações estratégicas por código
// Note: This remains static as it contains business logic, not just simple mappings.
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
