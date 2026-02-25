-- Schema SQL para o Client Kanban System no Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. leads (Aba 1: sheet1)
CREATE TABLE IF NOT EXISTS leads (
    cliente_id TEXT PRIMARY KEY,
    negocio_titulo TEXT,
    negocio_valor DECIMAL(15, 2),
    negocio_organizacao TEXT,
    negocio_pessoa_de_contato TEXT,
    negocio_data_de_fechamento_esperada TIMESTAMP WITH TIME ZONE,
    negocio_data_da_proxima_atividade TIMESTAMP WITH TIME ZONE,
    negocio_proprietario TEXT,
    negocio_etapa TEXT,
    negocio_fonte_do_lead TEXT,
    negocio_qualificacao_lead_closer TEXT,
    negocio_qualificacao_do_lead_sdr TEXT,
    negocio_motivo_da_perda TEXT,
    negocio_data_de_criacao_do_negocio TIMESTAMP WITH TIME ZONE,
    negocio_sdr_responsavel TEXT,
    negocio_ganho_em TIMESTAMP WITH TIME ZONE,
    negocio_data_de_perda TIMESTAMP WITH TIME ZONE,
    negocio_vlr_mensalidade DECIMAL(15, 2),
    negocio_vlr_implantacao DECIMAL(15, 2),
    negocio_ranking TEXT,
    negocio_negocio_fechado_em TIMESTAMP WITH TIME ZONE,
    negocio_closer_lead_e_o_decisor TEXT,
    negocio_atividades_concluidas INTEGER,
    negocio_atividades_para_fazer INTEGER,
    negocio_criador TEXT,
    negocio_data_atualizada TIMESTAMP WITH TIME ZONE,
    negocio_data_da_ultima_atividade TIMESTAMP WITH TIME ZONE,
    negocio_etiqueta TEXT,
    negocio_funil TEXT,
    negocio_moeda_de_vlr_mensalidade TEXT,
    negocio_moeda_de_vlr_implantacao TEXT,
    negocio_canal_de_origem TEXT,
    negocio_mrr DECIMAL(15, 2),
    negocio_valor_de_produtos DECIMAL(15, 2),
    negocio_valor_ponderado DECIMAL(15, 2),
    negocio_moeda TEXT,
    negocio_id TEXT,
    negocio_id_de_origem TEXT,
    negocio_id_do_canal_de_origem TEXT,
    negocio_nome_do_produto TEXT,
    negocio_numero_de_mensagens_de_e_mail INTEGER,
    negocio_origem TEXT,
    negocio_probabilidade DECIMAL(5, 2),
    negocio_acv DECIMAL(15, 2),
    negocio_arr DECIMAL(15, 2),
    negocio_quantidade_de_produtos INTEGER,
    negocio_telefone_do_closer TEXT,
    negocio_tempo_de_implantacao TEXT,
    negocio_total_de_atividades INTEGER,
    negocio_utm_campaign TEXT,
    negocio_utm_content TEXT,
    negocio_utm_medium TEXT,
    negocio_utm_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. layout_importacao_empresas (Aba 2)
CREATE TABLE IF NOT EXISTS layout_importacao_empresas (
    cliente_id TEXT PRIMARY KEY REFERENCES leads(cliente_id) ON DELETE CASCADE,
    nome_da_empresa TEXT,
    site_empresa TEXT,
    pais_empresa TEXT,
    estado_empresa TEXT,
    cidade_empresa TEXT,
    logradouro_empresa TEXT,
    numero_empresa TEXT,
    bairro_empresa TEXT,
    complemento_empresa TEXT,
    cep_empresa TEXT,
    cnpj_empresa TEXT,
    ddi_empresa TEXT,
    telefones_empresa TEXT,
    observacao_empresa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. leads_exact_spotter (Aba 3)
CREATE TABLE IF NOT EXISTS leads_exact_spotter (
    cliente_id TEXT PRIMARY KEY REFERENCES leads(cliente_id) ON DELETE CASCADE,
    nome_do_lead TEXT,
    origem TEXT,
    sub_origem TEXT,
    mercado TEXT,
    produto TEXT,
    site TEXT,
    pais TEXT,
    estado TEXT,
    cidade TEXT,
    logradouro TEXT,
    numero TEXT,
    bairro TEXT,
    complemento TEXT,
    cep TEXT,
    ddi TEXT,
    telefones TEXT,
    observacao TEXT,
    cpf_cnpj TEXT,
    nome_contato TEXT,
    e_mail_contato TEXT,
    cargo_contato TEXT,
    ddi_contato TEXT,
    telefones_contato TEXT,
    tipo_do_serv_comunicacao TEXT,
    id_do_serv_comunicacao TEXT,
    area TEXT,
    nome_da_empresa TEXT,
    etapa TEXT,
    funil TEXT,
    empresa_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. perdecomp (Aba 4)
CREATE TABLE IF NOT EXISTS perdecomp (
    perdcomp_id TEXT PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    nome_da_empresa TEXT,
    cnpj TEXT,
    tipo_pedido TEXT,
    situacao TEXT,
    periodo_inicio DATE,
    periodo_fim DATE,
    quantidade_perdcomp INTEGER,
    numero_processo TEXT,
    data_protocolo TIMESTAMP WITH TIME ZONE,
    ultima_atualizacao TIMESTAMP WITH TIME ZONE,
    quantidade_receitas INTEGER,
    quantidade_origens INTEGER,
    quantidade_dar_fs INTEGER,
    url_comprovante_html TEXT,
    url_comprovante_pdf TEXT,
    data_consulta TIMESTAMP WITH TIME ZONE,
    tipo_empresa TEXT,
    concorrentes TEXT,
    json_bruto JSONB,
    empresa_id TEXT,
    code TEXT,
    code_message TEXT,
    mapped_count INTEGER,
    perdcomp_principal_id TEXT,
    perdcomp_solicitante TEXT,
    perdcomp_tipo_documento TEXT,
    perdcomp_tipo_credito TEXT,
    perdcomp_data_transmissao TIMESTAMP WITH TIME ZONE,
    perdcomp_situacao TEXT,
    perdcomp_situacao_detalhamento TEXT,
    qtd_perdcomp_dcomp INTEGER,
    qtd_perdcomp_rest INTEGER,
    qtd_perdcomp_cancel INTEGER,
    qtd_perdcomp_ressarc INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. perdecomp_itens (Aba 5)
CREATE TABLE IF NOT EXISTS perdecomp_itens (
    id BIGSERIAL PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    empresa_id TEXT,
    nome_da_empresa TEXT,
    cnpj TEXT,
    perdcomp_numero TEXT,
    perdcomp_formatado TEXT,
    b1 TEXT,
    b2 TEXT,
    data_ddmmaa TEXT,
    data_iso TIMESTAMP WITH TIME ZONE,
    tipo_codigo TEXT,
    tipo_nome TEXT,
    natureza TEXT,
    familia TEXT,
    credito_codigo TEXT,
    credito_descricao TEXT,
    protocolo TEXT,
    situacao TEXT,
    situacao_detalhamento TEXT,
    motivo_normalizado TEXT,
    solicitante TEXT,
    fonte TEXT,
    data_consulta TIMESTAMP WITH TIME ZONE,
    url_comprovante_html TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. perdecomp_facts (Aba 6)
CREATE TABLE IF NOT EXISTS perdecomp_facts (
    id BIGSERIAL PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    empresa_id TEXT,
    nome_da_empresa TEXT,
    cnpj TEXT,
    perdcomp_numero TEXT,
    perdcomp_formatado TEXT,
    b1 TEXT,
    b2 TEXT,
    data_ddmmaa TEXT,
    data_iso TIMESTAMP WITH TIME ZONE,
    tipo_codigo TEXT,
    tipo_nome TEXT,
    natureza TEXT,
    familia TEXT,
    credito_codigo TEXT,
    credito_descricao TEXT,
    risco_nivel TEXT,
    protocolo TEXT,
    situacao TEXT,
    situacao_detalhamento TEXT,
    motivo_normalizado TEXT,
    solicitante TEXT,
    fonte TEXT,
    data_consulta TIMESTAMP WITH TIME ZONE,
    url_comprovante_html TEXT,
    row_hash TEXT,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    consulta_id TEXT,
    version TEXT,
    deleted_flag BOOLEAN DEFAULT FALSE
);

-- 7. perdecomp_snapshot (Aba 7)
CREATE TABLE IF NOT EXISTS perdecomp_snapshot (
    id BIGSERIAL PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    empresa_id TEXT,
    nome_da_empresa TEXT,
    cnpj TEXT,
    qtd_total INTEGER,
    qtd_dcomp INTEGER,
    qtd_rest INTEGER,
    qtd_ressarc INTEGER,
    risco_nivel TEXT,
    risco_tags_json JSONB,
    por_natureza_json JSONB,
    por_credito_json JSONB,
    datas_json JSONB,
    primeira_data_iso TIMESTAMP WITH TIME ZONE,
    ultima_data_iso TIMESTAMP WITH TIME ZONE,
    resumo_ultima_consulta_json_p1 JSONB,
    resumo_ultima_consulta_json_p2 JSONB,
    card_schema_version TEXT,
    rendered_at_iso TIMESTAMP WITH TIME ZONE,
    fonte TEXT,
    data_consulta TIMESTAMP WITH TIME ZONE,
    url_comprovante_html TEXT,
    payload_bytes BIGINT,
    last_updated_iso TIMESTAMP WITH TIME ZONE,
    snapshot_hash TEXT,
    facts_count INTEGER,
    consulta_id TEXT,
    erro_ultima_consulta TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. padroes (Aba 8)
CREATE TABLE IF NOT EXISTS padroes (
    id BIGSERIAL PRIMARY KEY,
    prudutos TEXT,
    mercados TEXT,
    area TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. historico_interacoes (Aba 9)
CREATE TABLE IF NOT EXISTS historico_interacoes (
    message_id TEXT PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    data_hora TIMESTAMP WITH TIME ZONE,
    tipo TEXT,
    de_fase TEXT,
    para_fase TEXT,
    canal TEXT,
    observacao TEXT,
    mensagem TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. mensagens (Aba 10)
CREATE TABLE IF NOT EXISTS mensagens (
    id BIGSERIAL PRIMARY KEY,
    titulo TEXT,
    aplicativo TEXT,
    mensagem TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. historico_whats_app (Aba 11)
CREATE TABLE IF NOT EXISTS historico_whats_app (
    id BIGSERIAL PRIMARY KEY,
    cliente_id TEXT REFERENCES leads(cliente_id) ON DELETE CASCADE,
    numero TEXT,
    mensagem TEXT,
    direcao TEXT,
    data_hora TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. usuarios (Aba 12)
CREATE TABLE IF NOT EXISTS usuarios (
    usuario_id TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT UNIQUE,
    hash_senha TEXT,
    role TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    tentativas_login INTEGER DEFAULT 0,
    bloqueado_ate TIMESTAMP WITH TIME ZONE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    token_reset TEXT,
    expira_reset TIMESTAMP WITH TIME ZONE,
    teste_nova_coluna TEXT,
    secret_word TEXT
);

-- 13. dic_tipos (Aba 13)
CREATE TABLE IF NOT EXISTS dic_tipos (
    tipo_codigo TEXT PRIMARY KEY,
    tipo_nome TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. dic_naturezas (Aba 14)
CREATE TABLE IF NOT EXISTS dic_naturezas (
    id BIGSERIAL PRIMARY KEY,
    natureza TEXT,
    familia TEXT,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. dic_creditos (Aba 15)
CREATE TABLE IF NOT EXISTS dic_creditos (
    credito_codigo TEXT PRIMARY KEY,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. dic_situacoes (Aba 16)
CREATE TABLE IF NOT EXISTS dic_situacoes (
    id BIGSERIAL PRIMARY KEY,
    situacao_original TEXT,
    detalhe_original TEXT,
    motivo_normalizado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. rotas (Aba 17)
CREATE TABLE IF NOT EXISTS rotas (
    rota_codigo TEXT PRIMARY KEY,
    rota_path TEXT,
    descricao TEXT,
    ativa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. permissoes (Aba 18)
CREATE TABLE IF NOT EXISTS permissoes (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT,
    rota TEXT REFERENCES rotas(rota_codigo),
    role TEXT,
    visualizar BOOLEAN DEFAULT FALSE,
    editar BOOLEAN DEFAULT FALSE,
    excluir BOOLEAN DEFAULT FALSE,
    exportar BOOLEAN DEFAULT FALSE,
    enviar_crm BOOLEAN DEFAULT FALSE,
    gerar_pdf BOOLEAN DEFAULT FALSE,
    enriquecer BOOLEAN DEFAULT FALSE,
    consultar_perdcomp BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    enviar_spotter BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. vocab_permissoes (Aba 19)
CREATE TABLE IF NOT EXISTS vocab_permissoes (
    chave TEXT PRIMARY KEY,
    descricao TEXT,
    escopo TEXT,
    rota_padrao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. roles_default (Aba 20)
CREATE TABLE IF NOT EXISTS roles_default (
    id BIGSERIAL PRIMARY KEY,
    role TEXT,
    rota TEXT REFERENCES rotas(rota_codigo),
    visualizar BOOLEAN DEFAULT FALSE,
    editar BOOLEAN DEFAULT FALSE,
    excluir BOOLEAN DEFAULT FALSE,
    exportar BOOLEAN DEFAULT FALSE,
    enviar_crm BOOLEAN DEFAULT FALSE,
    gerar_pdf BOOLEAN DEFAULT FALSE,
    enriquecer BOOLEAN DEFAULT FALSE,
    consultar_perdcomp BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. auditoria_acesso (Aba 21)
CREATE TABLE IF NOT EXISTS auditoria_acesso (
    evento_id TEXT PRIMARY KEY,
    usuario_email TEXT,
    tipo_evento TEXT,
    origem_ip TEXT,
    user_agent TEXT,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    detalhes JSONB
);

-- 22. auditoria_acao (Aba 22)
CREATE TABLE IF NOT EXISTS auditoria_acao (
    evento_id TEXT PRIMARY KEY,
    usuario_email TEXT,
    rota TEXT,
    acao TEXT,
    sucesso BOOLEAN,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payload_resumo JSONB
);

-- 23. teses (Aba 23)
CREATE TABLE IF NOT EXISTS teses (
    tese_id TEXT PRIMARY KEY,
    tipo TEXT,
    tema TEXT,
    tributo_do_credito TEXT,
    base_legal TEXT,
    contexto_do_direito TEXT,
    documentacao_necessaria TEXT,
    informacoes_a_serem_analisadas TEXT,
    forma_de_utilizacao TEXT,
    publico_alvo TEXT,
    grau_de_risco TEXT,
    status TEXT,
    via TEXT,
    grau_de_risco_judicial TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. cnae (Aba 24)
CREATE TABLE IF NOT EXISTS cnae (
    cnae_id TEXT PRIMARY KEY,
    cnae TEXT,
    desc_cnae TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para rastrear logs de migração
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    spreadsheet_id TEXT,
    results JSONB, -- Armazena o array de resultados por tabela
    status TEXT, -- 'sucesso', 'parcial', 'erro'
    error_message TEXT
);
