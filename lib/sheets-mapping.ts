/**
 * @file Centralized mapping for Google Sheet names and columns.
 * This file serves as the single source of truth for all sheet-related constants.
 */

/**
 * An object containing the exact names of the tabs in the Google Sheet.
 * Using this object prevents typos and ensures consistency.
 */
export const SHEETS = {
  SHEET1: 'sheet1',
  LAYOUT_IMPORTACAO_EMPRESAS: 'layout_importacao_empresas',
  LEADS_EXACT_SPOTTER: 'leads_exact_spotter',
  PERDECOMP: 'perdecomp',
  PERDCOMP_ITENS: 'perdcomp_itens',
  PERDCOMP_FACTS: 'perdecomp_facts',
  PERDECOMP_SNAPSHOT: 'perdecomp_snapshot',
  PADROES: 'padroes',
  HISTORICO_INTERACOES: 'historico_interacoes',
  MENSAGENS: 'mensagens',
  HISTORICO_WHATS_APP: 'historico_whats_app',
  USUARIOS: 'usuarios',
  DIC_TIPOS: 'dic_tipos',
  DIC_NATUREZAS: 'dic_naturezas',
  DIC_CREDITOS: 'dic_creditos',
  DIC_SITUACOES: 'dic_situacoes',
  ROTAS: 'rotas',
  PERMISSOES: 'permissoes',
  VOCAB_PERMISSOES: 'vocab_permissoes',
  ROLES_DEFAULT: 'roles_default',
  AUDITORIA_ACESSO: 'auditoria_acesso',
  AUDITORIA_ACAO: 'auditoria_acao',
  TESES: 'teses',
  CNAE: 'cnae',
} as const; // Using 'as const' to make values read-only and string literals.

/**
 * Type helper to get the values of the SHEETS object.
 */
export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

// --- Column Mappings ---

// Helper function to create a 1:1 mapping from a list of keys.
const createIdentityMapping = <T extends string>(columns: T[]) => {
  return columns.reduce(
    (acc, key) => {
      acc[key] = key;
      return acc;
    },
    {} as { [K in T]: K }
  );
};

/**
 * Columns for the 'sheet1' tab.
 * Inferred from the `buildSheet1Row` function in `lib/googleSheets.js`.
 */
export const SHEET1_COLUMNS = createIdentityMapping([
  'negocio_titulo', 'negocio_valor', 'negocio_organizacao', 'negocio_pessoa_de_contato',
  'negocio_data_de_fechamento_esperada', 'negocio_data_da_proxima_atividade', 'negocio_proprietario',
  'negocio_etapa', 'negocio_fonte_do_lead', 'negocio_qualificacao_lead_closer',
  'negocio_qualificacao_do_lead_sdr', 'negocio_motivo_da_perda', 'negocio_data_de_criacao_do_negocio',
  'negocio_sdr_responsavel', 'negocio_ganho_em', 'negocio_data_de_perda', 'negocio_vlr_mensalidade',
  'negocio_vlr_implantacao', 'negocio_ranking', 'negocio_negocio_fechado_em', 'negocio_closer_lead_e_o_decisor',
  'negocio_atividades_concluidas', 'negocio_atividades_para_fazer', 'negocio_criador', 'negocio_data_atualizada',
  'negocio_data_da_ultima_atividade', 'negocio_etiqueta', 'negocio_funil', 'negocio_moeda_de_vlr_mensalidade',
  'negocio_moeda_de_vlr_implantacao', 'negocio_canal_de_origem', 'negocio_mrr', 'negocio_valor_de_produtos',
  'negocio_valor_ponderado', 'negocio_moeda', 'negocio_id', 'negocio_id_de_origem', 'negocio_id_do_canal_de_origem',
  'negocio_nome_do_produto', 'negocio_numero_de_mensagens_de_e-mail', 'negocio_origem', 'negocio_probabilidade',
  'negocio_acv', 'negocio_arr', 'negocio_quantidade_de_produtos', 'negocio_telefone_do_closer',
  'negocio_tempo_de_implantacao', 'negocio_total_de_atividades', 'negocio_utm_campaign', 'negocio_utm_content',
  'negocio_utm_medium', 'negocio_utm_source', 'negocio_utm_term', 'negocio_visivel_para',
  'negocio_ultima_alteracao_de_etapa', 'negocio_ultimo_e-mail_enviado', 'negocio_ultimo_e-mail_recebido',
  'pessoa_cargo', 'pessoa_email_work', 'pessoa_email_home', 'pessoa_email_other', 'pessoa_end_linkedin',
  'pessoa_phone_work', 'pessoa_phone_home', 'pessoa_phone_mobile', 'pessoa_phone_other', 'pessoa_telefone',
  'pessoa_celular', 'organizacao_nome', 'organizacao_segmento', 'organizacao_tamanho_da_empresa',
  'negocio_status', 'ddd', 'uf', 'cidade_estimada', 'fonte_localizacao', 'status_kanban', 'cor_card',
  'data_ultima_movimentacao', 'impresso_lista', 'telefone_normalizado', 'cliente_id'
]);

/**
 * Columns for the 'layout_importacao_empresas' tab.
 */
export const LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS = createIdentityMapping([
    'cliente_id', 'nome_da_empresa', 'site_empresa', 'pais_empresa', 'estado_empresa', 'cidade_empresa',
    'logradouro_empresa', 'numero_empresa', 'bairro_empresa', 'complemento_empresa', 'cep_empresa',
    'cnpj_empresa', 'ddi_empresa', 'telefones_empresa', 'observacao_empresa'
]);

/**
 * Columns for the 'leads_exact_spotter' tab.
 * Inferred from the `buildLeadsExactSpotterRow` function in `lib/googleSheets.js`.
 */
export const LEADS_EXACT_SPOTTER_COLUMNS = createIdentityMapping([
  'cliente_id', 'nome_do_lead', 'origem', 'sub_origem', 'mercado', 'produto', 'site', 'pais', 'estado',
  'cidade', 'logradouro', 'numero', 'bairro', 'complemento', 'cep', 'ddi', 'telefones', 'observacao',
  'cpf_cnpj', 'nome_contato', 'email_contato', 'cargo_contato', 'ddi_contato', 'telefones_contato',
  'tipo_do_serv_comunicacao', 'id_do_serv_comunicacao', 'area', 'nome_da_empresa', 'etapa', 'funil'
]);

/**
 * Columns for the 'perdecomp' tab.
 * Based on common fields for this entity.
 */
export const PERDECOMP_COLUMNS = createIdentityMapping([
    'cliente_id', 'cnpj', 'razao_social', 'documento', 'valor', 'data_transmissao', 'status_receita',
    'saldo_estimado'
]);

/**
 * Columns for the 'perdcomp_facts' tab.
 */
export const PERDCOMP_FACTS_COLUMNS = createIdentityMapping([
    'fact_id', 'cliente_id', 'cnpj', 'perdcomp_numero', 'tipo_documento', 'data_transmissao', 'valor_credito',
    'natureza_credito', 'detalhe_credito', 'competencia_apuracao'
]);

/**
 * Columns for the 'perdecomp_snapshot' tab.
 */
export const PERDECOMP_SNAPSHOT_COLUMNS = createIdentityMapping([
    'snapshot_id', 'cliente_id', 'cnpj', 'data_snapshot', 'total_creditos', 'total_ débitos',
    'saldo_consolidado', 'fonte_dados'
]);

/**
 * Columns for the 'usuarios' tab.
 */
export const USUARIOS_COLUMNS = createIdentityMapping([
    'usuario_id', 'nome', 'email', 'role', 'status', 'ultimo_login'
]);

/**
 * Columns for the 'permissoes' tab.
 */
export const PERMISSOES_COLUMNS = createIdentityMapping([
    'permissao_id', 'role', 'recurso', 'acao', 'nivel_acesso'
]);
