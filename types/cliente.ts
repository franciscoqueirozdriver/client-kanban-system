export interface Cliente {
  cliente_id: string;
  nome_da_empresa: string;
  empresa_id: string;
  organizacao_segmento: string;
  organizacao_tamanho_da_empresa: string;
  organizacao_nome: string;
  pessoa_nome: string;
  pessoa_cargo: string;
  pessoa_email_work: string;
  pessoa_email_home: string;
  pessoa_email_other: string;
  pessoa_phone_work: string;
  pessoa_phone_home: string;
  pessoa_phone_mobile: string;
  pessoa_phone_other: string;
  pessoa_celular: string;
  pessoa_telefone: string;
  pessoa_end_linkedin: string;
  status_kanban: string;
  data_ultima_movimentacao: string;
  cor_card: string;
  telefone_normalizado: string;
  impresso_lista: string;
  negocio_titulo: string;
  negocio_valor: string;
  negocio_organizacao: string;
  negocio_pessoa_de_contato: string;
  negocio_data_de_fechamento_esperada: string;
  negocio_data_da_proxima_atividade: string;
  negocio_proprietario: string;

  // From leads_exact_spotter, as they are used in client context
    cpf_cnpj: string;
}
