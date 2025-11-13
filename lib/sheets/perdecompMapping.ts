// lib/sheets/perdecompMapping.ts

export const LEGACY_PERDECOMP_TO_SNAKE: Record<string, string> = {
  // --------- CAMPOS PERDCOMP (SHEET "perdecomp") ---------

  // IDs e relacionamento
  Perdcomp_ID: 'perdcomp_id',
  PERDCOMP_ID: 'perdcomp_id',

  Perdcomp_Principal_ID: 'perdcomp_principal_id',
  PERDCOMP_Principal_ID: 'perdcomp_principal_id',

  // Atributos principais do PER/DCOMP
  Perdcomp_Solicitante: 'perdcomp_solicitante',
  PERDCOMP_Solicitante: 'perdcomp_solicitante',

  Perdcomp_Tipo_Documento: 'perdcomp_tipo_documento',
  PERDCOMP_Tipo_Documento: 'perdcomp_tipo_documento',

  Perdcomp_Tipo_Credito: 'perdcomp_tipo_credito',
  PERDCOMP_Tipo_Credito: 'perdcomp_tipo_credito',

  Perdcomp_Data_Transmissao: 'perdcomp_data_transmissao',
  PERDCOMP_Data_Transmissao: 'perdcomp_data_transmissao',

  Perdcomp_Situacao: 'perdcomp_situacao',
  PERDCOMP_Situacao: 'perdcomp_situacao',

  Perdcomp_Situacao_Detalhamento: 'perdcomp_situacao_detalhamento',
  PERDCOMP_Situacao_Detalhamento: 'perdcomp_situacao_detalhamento',

  // Contagens agregadas
  Qtd_PERDCOMP_DCOMP: 'qtd_perdcomp_dcomp',
  QTD_PERDCOMP_DCOMP: 'qtd_perdcomp_dcomp',

  Qtd_PERDCOMP_REST: 'qtd_perdcomp_rest',
  QTD_PERDCOMP_REST: 'qtd_perdcomp_rest',

  Qtd_PERDCOMP_CANCEL: 'qtd_perdcomp_cancel',
  QTD_PERDCOMP_CANCEL: 'qtd_perdcomp_cancel',

  Qtd_PERDCOMP_RESSARC: 'qtd_perdcomp_ressarc',
  QTD_PERDCOMP_RESSARC: 'qtd_perdcomp_ressarc',

  // --------- CAMPOS PERDCOMP FACTS (SHEET "perdecomp_facts") ---------

  Perdcomp_Numero: 'perdcomp_numero',
  PERDCOMP_Numero: 'perdcomp_numero',

  Perdcomp_Formatado: 'perdcomp_formatado',
  PERDCOMP_Formatado: 'perdcomp_formatado',
};

export function normalizePerdecompLegacyKeys<T extends Record<string, any>>(
  row: T,
): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    const mappedKey = LEGACY_PERDECOMP_TO_SNAKE[key] ?? key;
    normalized[mappedKey] = value;
  }

  return normalized;
}
