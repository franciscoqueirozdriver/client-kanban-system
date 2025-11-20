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
} as const;

/**
 * Type helper to get the values of the SHEETS object.
 */
export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

// --- Column Mappings ---

/**
 * Columns for the 'sheet1' tab.
 */
export const SHEET1_COLUMNS = {
  negocio_titulo: 'negocio_titulo',
  negocio_valor: 'negocio_valor',
  negocio_organizacao: 'negocio_organizacao',
  negocio_pessoa_de_contato: 'negocio_pessoa_de_contato',
  negocio_data_de_fechamento_esperada: 'negocio_data_de_fechamento_esperada',
  negocio_data_da_proxima_atividade: 'negocio_data_da_proxima_atividade',
  negocio_proprietario: 'negocio_proprietario',
  negocio_etapa: 'negocio_etapa',
  negocio_fonte_do_lead: 'negocio_fonte_do_lead',
  negocio_qualificacao_lead_closer: 'negocio_qualificacao_lead_closer',
  negocio_qualificacao_do_lead_sdr: 'negocio_qualificacao_do_lead_sdr',
  negocio_motivo_da_perda: 'negocio_motivo_da_perda',
  negocio_data_de_criacao_do_negocio: 'negocio_data_de_criacao_do_negocio',
  negocio_sdr_responsavel: 'negocio_sdr_responsavel',
  negocio_ganho_em: 'negocio_ganho_em',
  negocio_data_de_perda: 'negocio_data_de_perda',
  negocio_vlr_mensalidade: 'negocio_vlr_mensalidade',
  negocio_vlr_implantacao: 'negocio_vlr_implantacao',
  negocio_ranking: 'negocio_ranking',
  negocio_negocio_fechado_em: 'negocio_negocio_fechado_em',
  negocio_closer_lead_e_o_decisor: 'negocio_closer_lead_e_o_decisor',
  negocio_atividades_concluidas: 'negocio_atividades_concluidas',
  negocio_atividades_para_fazer: 'negocio_atividades_para_fazer',
  negocio_criador: 'negocio_criador',
  negocio_data_atualizada: 'negocio_data_atualizada',
  negocio_data_da_ultima_atividade: 'negocio_data_da_ultima_atividade',
  negocio_etiqueta: 'negocio_etiqueta',
  negocio_funil: 'negocio_funil',
  negocio_moeda_de_vlr_mensalidade: 'negocio_moeda_de_vlr_mensalidade',
  negocio_moeda_de_vlr_implantacao: 'negocio_moeda_de_vlr_implantacao',
  negocio_canal_de_origem: 'negocio_canal_de_origem',
  negocio_mrr: 'negocio_mrr',
  negocio_valor_de_produtos: 'negocio_valor_de_produtos',
  negocio_valor_ponderado: 'negocio_valor_ponderado',
  negocio_moeda: 'negocio_moeda',
  negocio_id: 'negocio_id',
  negocio_id_de_origem: 'negocio_id_de_origem',
  negocio_id_do_canal_de_origem: 'negocio_id_do_canal_de_origem',
  negocio_nome_do_produto: 'negocio_nome_do_produto',
  negocio_numero_de_mensagens_de_e_mail: 'negocio_numero_de_mensagens_de_e_mail',
  negocio_origem: 'negocio_origem',
  negocio_probabilidade: 'negocio_probabilidade',
  negocio_acv: 'negocio_acv',
  negocio_arr: 'negocio_arr',
  negocio_quantidade_de_produtos: 'negocio_quantidade_de_produtos',
  negocio_telefone_do_closer: 'negocio_telefone_do_closer',
  negocio_tempo_de_implantacao: 'negocio_tempo_de_implantacao',
  negocio_total_de_atividades: 'negocio_total_de_atividades',
  negocio_utm_campaign: 'negocio_utm_campaign',
  negocio_utm_content: 'negocio_utm_content',
  negocio_utm_medium: 'negocio_utm_medium',
  negocio_utm_source: 'negocio_utm_source',
  negocio_utm_term: 'negocio_utm_term',
  negocio_visivel_para: 'negocio_visivel_para',
  negocio_ultima_alteracao_de_etapa: 'negocio_ultima_alteracao_de_etapa',
  negocio_ultimo_e_mail_enviado: 'negocio_ultimo_e_mail_enviado',
  negocio_ultimo_e_mail_recebido: 'negocio_ultimo_e_mail_recebido',
  pessoa_cargo: 'pessoa_cargo',
  pessoa_email_work: 'pessoa_email_work',
  pessoa_email_home: 'pessoa_email_home',
  pessoa_email_other: 'pessoa_email_other',
  pessoa_end_linkedin: 'pessoa_end_linkedin',
  pessoa_phone_work: 'pessoa_phone_work',
  pessoa_phone_home: 'pessoa_phone_home',
  pessoa_phone_mobile: 'pessoa_phone_mobile',
  pessoa_phone_other: 'pessoa_phone_other',
  pessoa_telefone: 'pessoa_telefone',
  pessoa_celular: 'pessoa_celular',
  organizacao_nome: 'organizacao_nome',
  organizacao_segmento: 'organizacao_segmento',
  organizacao_tamanho_da_empresa: 'organizacao_tamanho_da_empresa',
  negocio_status: 'negocio_status',
  ddd: 'ddd',
  uf: 'uf',
  cidade_estimada: 'cidade_estimada',
  fonte_localizacao: 'fonte_localizacao',
  status_kanban: 'status_kanban',
  cor_card: 'cor_card',
  data_ultima_movimentacao: 'data_ultima_movimentacao',
  impresso_lista: 'impresso_lista',
  telefone_normalizado: 'telefone_normalizado',
  cliente_id: 'cliente_id',
} as const;

/**
 * Columns for the 'layout_importacao_empresas' tab.
 */
export const LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS = {
  cliente_id: 'cliente_id',
  nome_da_empresa: 'nome_da_empresa',
  site_empresa: 'site_empresa',
  pais_empresa: 'pais_empresa',
  estado_empresa: 'estado_empresa',
  cidade_empresa: 'cidade_empresa',
  logradouro_empresa: 'logradouro_empresa',
  numero_empresa: 'numero_empresa',
  bairro_empresa: 'bairro_empresa',
  complemento_empresa: 'complemento_empresa',
  cep_empresa: 'cep_empresa',
  cnpj_empresa: 'cnpj_empresa',
  ddi_empresa: 'ddi_empresa',
  telefones_empresa: 'telefones_empresa',
  observacao_empresa: 'observacao_empresa',
} as const;

/**
 * Columns for the 'leads_exact_spotter' tab.
 */
export const LEADS_EXACT_SPOTTER_COLUMNS = {
  cliente_id: 'cliente_id',
  nome_do_lead: 'nome_do_lead',
  origem: 'origem',
  sub_origem: 'sub_origem',
  mercado: 'mercado',
  produto: 'produto',
  site: 'site',
  pais: 'pais',
  estado: 'estado',
  cidade: 'cidade',
  logradouro: 'logradouro',
  numero: 'numero',
  bairro: 'bairro',
  complemento: 'complemento',
  cep: 'cep',
  ddi: 'ddi',
  telefones: 'telefones',
  observacao: 'observacao',
  cpf_cnpj: 'cpf_cnpj',
  nome_contato: 'nome_contato',
  email_contato: 'email_contato',
  cargo_contato: 'cargo_contato',
  ddi_contato: 'ddi_contato',
  telefones_contato: 'telefones_contato',
  tipo_do_serv_comunicacao: 'tipo_do_serv_comunicacao',
  id_do_serv_comunicacao: 'id_do_serv_comunicacao',
  area: 'area',
  nome_da_empresa: 'nome_da_empresa',
  etapa: 'etapa',
  funil: 'funil',
} as const;

/**
 * Columns for the 'perdecomp' tab.
 */
export const PERDECOMP_COLUMNS = {
  cliente_id: 'cliente_id',
  nome_da_empresa: 'nome_da_empresa',
  perdcomp_id: 'perdcomp_id',
  cnpj: 'cnpj',
  tipo_pedido: 'tipo_pedido',
  situacao: 'situacao',
  periodo_inicio: 'periodo_inicio',
  periodo_fim: 'periodo_fim',
  quantidade_perdcomp: 'quantidade_perdcomp',
  numero_processo: 'numero_processo',
  data_protocolo: 'data_protocolo',
  ultima_atualizacao: 'ultima_atualizacao',
  quantidade_receitas: 'quantidade_receitas',
  quantidade_origens: 'quantidade_origens',
  quantidade_dar_fs: 'quantidade_dar_fs',
  url_comprovante_html: 'url_comprovante_html',
  url_comprovante_pdf: 'url_comprovante_pdf',
  data_consulta: 'data_consulta',
  tipo_empresa: 'tipo_empresa',
  concorrentes: 'concorrentes',
  json_bruto: 'json_bruto',
  empresa_id: 'empresa_id',
  code: 'code',
  code_message: 'code_message',
  mapped_count: 'mapped_count',
  perdcomp_principal_id: 'perdcomp_principal_id',
  perdcomp_solicitante: 'perdcomp_solicitante',
  perdcomp_tipo_documento: 'perdcomp_tipo_documento',
  perdcomp_tipo_credito: 'perdcomp_tipo_credito',
  perdcomp_data_transmissao: 'perdcomp_data_transmissao',
  perdcomp_situacao: 'perdcomp_situacao',
  perdcomp_situacao_detalhamento: 'perdcomp_situacao_detalhamento',
  qtd_perdcomp_dcomp: 'qtd_perdcomp_dcomp',
  qtd_perdcomp_rest: 'qtd_perdcomp_rest',
  qtd_perdcomp_cancel: 'qtd_perdcomp_cancel',
  qtd_perdcomp_ressarc: 'qtd_perdcomp_ressarc',
} as const;

/**
 * Columns for the 'perdcomp_facts' tab.
 */
export const PERDCOMP_FACTS_COLUMNS = {
  cliente_id: 'cliente_id',
  empresa_id: 'empresa_id',
  nome_da_empresa: 'nome_da_empresa',
  cnpj: 'cnpj',
  perdcomp_numero: 'perdcomp_numero',
  perdcomp_formatado: 'perdcomp_formatado',
  b1: 'b1',
  b2: 'b2',
  data_ddmmaa: 'data_ddmmaa',
  data_iso: 'data_iso',
  tipo_codigo: 'tipo_codigo',
  tipo_nome: 'tipo_nome',
  natureza: 'natureza',
  familia: 'familia',
  credito_codigo: 'credito_codigo',
  credito_descricao: 'credito_descricao',
  risco_nivel: 'risco_nivel',
  protocolo: 'protocolo',
  situacao: 'situacao',
  situacao_detalhamento: 'situacao_detalhamento',
  motivo_normalizado: 'motivo_normalizado',
  solicitante: 'solicitante',
  fonte: 'fonte',
  data_consulta: 'data_consulta',
  url_comprovante_html: 'url_comprovante_html',
  row_hash: 'row_hash',
  inserted_at: 'inserted_at',
  consulta_id: 'consulta_id',
  version: 'version',
  deleted_flag: 'deleted_flag',
} as const;

/**
 * Columns for the 'perdecomp_snapshot' tab.
 */
export const PERDECOMP_SNAPSHOT_COLUMNS = {
  snapshot_id: 'snapshot_id',
  cliente_id: 'cliente_id',
  empresa_id: 'empresa_id',
  nome_da_empresa: 'nome_da_empresa',
  cnpj: 'cnpj',
  data_snapshot: 'data_snapshot',
  total_creditos: 'total_creditos',
  total_debitos: 'total_debitos',
  saldo_consolidado: 'saldo_consolidado',
  fonte_dados: 'fonte_dados',
  por_credito_json: 'por_credito_json',
  datas_json: 'datas_json',
  primeira_data_iso: 'primeira_data_iso',
  ultima_data_iso: 'ultima_data_iso',
  resumo_ultima_consulta_json_p1: 'resumo_ultima_consulta_json_p1',
  resumo_ultima_consulta_json_p2: 'resumo_ultima_consulta_json_p2',
  facts_count: 'facts_count',
  snapshot_hash: 'snapshot_hash',
  payload_bytes: 'payload_bytes',
  last_updated_iso: 'last_updated_iso',
  consulta_id: 'consulta_id',
  erro_ultima_consulta: 'erro_ultima_consulta',
} as const;

/**
 * Columns for the 'usuarios' tab.
 */
export const USUARIOS_COLUMNS = {
  usuario_id: 'usuario_id',
  nome: 'nome',
  email: 'email',
  role: 'role',
  status: 'status',
  ultimo_login: 'ultimo_login',
} as const;

/**
 * Columns for the 'permissoes' tab.
 */
export const PERMISSOES_COLUMNS = {
  permissao_id: 'permissao_id',
  role: 'role',
  recurso: 'recurso',
  acao: 'acao',
  nivel_acesso: 'nivel_acesso',
} as const;

/**
 * Columns for the 'teses' tab.
 */
export const TESES_COLUMNS = {
  tese_id: 'tese_id',
  tipo: 'tipo',
  tema: 'tema',
  tributo_do_credito: 'tributo_do_credito',
  base_legal: 'base_legal',
  contexto_do_direito: 'contexto_do_direito',
  documentacao_necessaria: 'documentacao_necessaria',
  informacoes_a_serem_analisadas: 'informacoes_a_serem_analisadas',
  forma_de_utilizacao: 'forma_de_utilizacao',
  publico_alvo: 'publico_alvo',
  grau_de_risco: 'grau_de_risco',
  status: 'status',
} as const;

/**
 * Columns for the 'cnae' tab.
 */
export const CNAE_COLUMNS = {
  cnae_id: 'cnae_id',
  cnae: 'cnae',
  desc_cnae: 'desc_cnae',
} as const;

/**
 * Columns for the 'auditoria_acao' tab.
 */
export const AUDITORIA_ACAO_COLUMNS = {
  evento_id: 'evento_id',
  usuario_email: 'usuario_email',
  acao: 'acao',
  sucesso: 'sucesso',
  data_hora: 'data_hora',
  payload_resumo: 'payload_resumo',
} as const;

/**
 * Columns for the 'auditoria_acesso' tab.
 */
export const AUDITORIA_ACESSO_COLUMNS = {
  evento_id: 'evento_id',
  usuario_email: 'usuario_email',
  rota: 'rota',
  sucesso: 'sucesso',
  data_hora: 'data_hora',
  payload_resumo: 'payload_resumo',
} as const;
