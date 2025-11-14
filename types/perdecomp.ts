export interface BaseRow {
    _rowNumber: number;
    [key: string]: any;
  }

  export interface PerdecompRow extends BaseRow {
    cliente_id: string;
    cnpj: string;
    razao_social: string;
    documento: string;
    valor: string;
    data_transmissao: string;
    status_receita: string;
    saldo_estimado: string;
    perdcomp_id?: string;
    tipo_pedido?: string;
    situacao?: string;
    periodo_inicio?: string;
    periodo_fim?: string;
    qtd_perdcomp_dcomp?: string;
    qtd_perdcomp_rest?: string;
    qtd_perdcomp_cancel?: string;
    qtd_perdcomp_ressarc?: string;
    data_consulta?: string;
  }

  export interface PerdcompItemRow extends BaseRow {
    item_id: string;
    perdcomp_id: string;
    tipo: string;
    valor: string;
  }

  export interface PerdcompFactsRow extends BaseRow {
    fact_id: string;
    cliente_id: string;
    cnpj: string;
    perdcomp_numero: string;
    tipo_documento: string;
    data_transmissao: string;
    valor_credito: string;
    natureza_credito: string;
    detalhe_credito: string;
    competencia_apuracao: string;
    risco_nivel?: string;
    row_hash?: string;
    inserted_at?: string;
    consulta_id?: string;
    version?: string;
    deleted_flag?: string;
    perdcomp_id?: string;
    data_consulta?: string;
  }

  export interface PerdecompSnapshotRow extends BaseRow {
    snapshot_id: string;
    cliente_id: string;
    cnpj: string;
    data_snapshot: string;
    total_creditos: string;
    'total_ débitos': string; // Note the space in the original mapping
    saldo_consolidado: string;
    fonte_dados: string;
    qtd_total?: string;
    qtd_dcomp?: string;
    qtd_rest?: string;
    qtd_ressarc?: string;
    risco_nivel?: string;
    por_natureza_json?: string;
    por_credito_json?: string;
    datas_json?: string;
    snapshot_hash?: string;
  }

  export interface DicTiposRow extends BaseRow {
    dic_id: string;
    familia_id: string;
    codigo: string;
    nome: string;
    descricao: string;
    fonte: string;
    exemplo_perdcomp: string;
    last_updated: string;
  }

  export interface DicNaturezasRow extends BaseRow {
    dic_id: string;
    familia_id: string;
    codigo: string;
    familia: string;
    nome: string;
    observacao: string;
    fonte: string;
    exemplo_perdcomp: string;
    last_updated: string;
  }

  export interface DicCreditosRow extends BaseRow {
    dic_id: string;
    familia_id: string;
    codigo: string;
    descricao: string;
    fonte: string;
    exemplo_perdcomp: string;
    last_updated: string;
  }

  export interface DicSituacoesRow extends BaseRow {
    dic_id: string;
    codigo: string;
    descricao: string;
    fonte: string;
    exemplo_perdcomp: string;
    last_updated: string;
  }

  export interface CnaeRow extends BaseRow {
    cnae_id: string;
    codigo: string;
    descricao: string;
  }

  export interface TeseRow extends BaseRow {
    tese_id: string;
    tipo: string;
    tema: string;
    tributo_do_credito: string;
    base_legal: string;
    contexto_do_direito: string;
    documentacao_necessaria: string;
    informacoes_a_serem_analisadas: string;
    forma_de_utilizacao: string;
    publico_alvo: string;
    grau_de_risco: string;
    status: string;
  }
