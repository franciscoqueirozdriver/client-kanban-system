/* eslint-disable */
/**
 * Script de Migração: Google Sheets para Supabase (Versão Completa)
 *
 * Este script lê os dados de múltiplas abas do Google Sheets e os insere
 * nas tabelas correspondentes do Supabase, com base nos cabeçalhos fornecidos.
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");

// Configurações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações do Google Sheets
const spreadsheetId = process.env.SPREADSHEET_ID;
const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: googleClientEmail,
    key: googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  } );
  return google.sheets({ version: "v4", auth });
}

async function getSheetData(sheets, sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });
  const rows = response.data.values || [];
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => (h || "").toString().trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? null;
    });
    return obj;
  });
}

function mapToSnakeCase(data, mapping) {
  return data.map((item) => {
    const newItem = {};
    Object.entries(mapping).forEach(([supabaseCol, sheetCol]) => {
      let value = item[sheetCol];

      // Tratamento básico de tipos para evitar strings vazias em campos numéricos/booleanos
      if (value === "" || value === undefined) {
        newItem[supabaseCol] = null;
      } else if (supabaseCol.includes("data_") || supabaseCol.includes("criado_em") || supabaseCol.includes("atualizado_em") || supabaseCol.includes("ultimo_login") || supabaseCol.includes("bloqueado_ate") || supabaseCol.includes("expira_reset")) {
        // Tentativa de converter para formato de data, se falhar, mantém como null
        try {
          newItem[supabaseCol] = new Date(value).toISOString();
        } catch (e) {
          newItem[supabaseCol] = null;
        }
      } else if (supabaseCol.includes("valor") || supabaseCol.includes("mrr") || supabaseCol.includes("arr") || supabaseCol.includes("probabilidade")) {
        newItem[supabaseCol] = parseFloat(String(value).replace(",", "."));
      } else if (supabaseCol.includes("quantidade") || supabaseCol.includes("atividades") || supabaseCol.includes("tentativas")) {
        newItem[supabaseCol] = parseInt(value, 10);
      } else if (supabaseCol.includes("ativo") || supabaseCol.includes("sucesso") || supabaseCol.includes("deleted_flag")) {
        newItem[supabaseCol] = String(value).toLowerCase() === "true" || String(value) === "1";
      } else if (supabaseCol.includes("json")) {
        try {
          newItem[supabaseCol] = JSON.parse(value);
        } catch (e) {
          newItem[supabaseCol] = value; // Mantém como string se não for JSON válido
        }
      } else {
        newItem[supabaseCol] = value;
      }
    });
    return newItem;
  });
}

async function migrateTable(sheets, sheetName, tableName, mapping, onConflictColumn = null) {
  console.log(`\n--- Iniciando migração de: ${sheetName} para: ${tableName} ---`);

  try {
    const rawData = await getSheetData(sheets, sheetName);
    console.log(`Total de registros encontrados no Sheets para ${sheetName}: ${rawData.length}`);

    if (rawData.length === 0) {
      console.log(`Nenhum dado encontrado em ${sheetName}. Pulando...`);
      return;
    }

    const mappedData = mapToSnakeCase(rawData, mapping);

    const batchSize = 100;
    for (let i = 0; i < mappedData.length; i += batchSize) {
      const batch = mappedData.slice(i, i + batchSize);
      let query = supabase.from(tableName);

      if (onConflictColumn) {
        query = query.upsert(batch, { onConflict: onConflictColumn, ignoreDuplicates: false });
      } else {
        // Para tabelas sem onConflict definido (ex: com PK auto-gerada ou onde duplicatas são aceitas)
        query = query.insert(batch);
      }

      const { error } = await query;

      if (error) {
        console.error(`Erro ao processar lote ${i / batchSize + 1} para ${tableName}:`, error.message);
        // console.error("Dados do lote com erro:", batch);
      } else {
        console.log(`Lote ${i / batchSize + 1} processado com sucesso para ${tableName} (${batch.length} registros).`);
      }
    }

    console.log(`Migração de ${tableName} concluída.`);
  } catch (error) {
    console.error(`Falha crítica na migração de ${tableName}:`, error.message);
  }
}

async function main() {
  if (!supabaseUrl || !supabaseKey || !spreadsheetId || !googleClientEmail || !googlePrivateKey) {
    console.error("Erro: Variáveis de ambiente SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY não configuradas.");
    process.exit(1);
  }

  const sheets = await getSheetsClient();

  // Mapeamentos para todas as 24 abas
  const MAPPINGS = {
    sheet1: {
      tableName: "leads",
      onConflict: "cliente_id",
      mapping: {
        cliente_id: "cliente_id",
        negocio_titulo: "negocio_titulo",
        negocio_valor: "negocio_valor",
        negocio_organizacao: "negocio_organizacao",
        negocio_pessoa_de_contato: "negocio_pessoa_de_contato",
        negocio_data_de_fechamento_esperada: "negocio_data_de_fechamento_esperada",
        negocio_data_da_proxima_atividade: "negocio_data_da_proxima_atividade",
        negocio_proprietario: "negocio_proprietario",
        negocio_etapa: "negocio_etapa",
        negocio_fonte_do_lead: "negocio_fonte_do_lead",
        negocio_qualificacao_lead_closer: "negocio_qualificacao_lead_closer",
        negocio_qualificacao_do_lead_sdr: "negocio_qualificacao_do_lead_sdr",
        negocio_motivo_da_perda: "negocio_motivo_da_perda",
        negocio_data_de_criacao_do_negocio: "negocio_data_de_criacao_do_negocio",
        negocio_sdr_responsavel: "negocio_sdr_responsavel",
        negocio_ganho_em: "negocio_ganho_em",
        negocio_data_de_perda: "negocio_data_de_perda",
        negocio_vlr_mensalidade: "negocio_vlr_mensalidade",
        negocio_vlr_implantacao: "negocio_vlr_implantacao",
        negocio_ranking: "negocio_ranking",
        negocio_negocio_fechado_em: "negocio_negocio_fechado_em",
        negocio_closer_lead_e_o_decisor: "negocio_closer_lead_e_o_decisor",
        negocio_atividades_concluidas: "negocio_atividades_concluidas",
        negocio_atividades_para_fazer: "negocio_atividades_para_fazer",
        negocio_criador: "negocio_criador",
        negocio_data_atualizada: "negocio_data_atualizada",
        negocio_data_da_ultima_atividade: "negocio_data_da_ultima_atividade",
        negocio_etiqueta: "negocio_etiqueta",
        negocio_funil: "negocio_funil",
        negocio_moeda_de_vlr_mensalidade: "negocio_moeda_de_vlr_mensalidade",
        negocio_moeda_de_vlr_implantacao: "negocio_moeda_de_vlr_implantacao",
        negocio_canal_de_origem: "negocio_canal_de_origem",
        negocio_mrr: "negocio_mrr",
        negocio_valor_de_produtos: "negocio_valor_de_produtos",
        negocio_valor_ponderado: "negocio_valor_ponderado",
        negocio_moeda: "negocio_moeda",
        negocio_id: "negocio_id",
        negocio_id_de_origem: "negocio_id_de_origem",
        negocio_id_do_canal_de_origem: "negocio_id_do_canal_de_origem",
        negocio_nome_do_produto: "negocio_nome_do_produto",
        negocio_numero_de_mensagens_de_e_mail: "negocio_numero_de_mensagens_de_e_mail",
        negocio_origem: "negocio_origem",
        negocio_probabilidade: "negocio_probabilidade",
        negocio_acv: "negocio_acv",
        negocio_arr: "negocio_arr",
        negocio_quantidade_de_produtos: "negocio_quantidade_de_produtos",
        negocio_telefone_do_closer: "negocio_telefone_do_closer",
        negocio_tempo_de_implantacao: "negocio_tempo_de_implantacao",
        negocio_total_de_atividades: "negocio_total_de_atividades",
        negocio_utm_campaign: "negocio_utm_campaign",
        negocio_utm_content: "negocio_utm_content",
        negocio_utm_medium: "negocio_utm_medium",
        negocio_utm_source: "negocio_utm_source",
        negocio_utm_term: "negocio_utm_term",
        negocio_visivel_para: "negocio_visivel_para",
        negocio_ultima_alteracao_de_etapa: "negocio_ultima_alteracao_de_etapa",
        negocio_ultimo_e_mail_enviado: "negocio_ultimo_e_mail_enviado",
        negocio_ultimo_e_mail_recebido: "negocio_ultimo_e_mail_recebido",
        pessoa_cargo: "pessoa_cargo",
        pessoa_email_work: "pessoa_email_work",
        pessoa_email_home: "pessoa_email_home",
        pessoa_email_other: "pessoa_email_other",
        pessoa_end_linkedin: "pessoa_end_linkedin",
        pessoa_phone_work: "pessoa_phone_work",
        pessoa_phone_home: "pessoa_phone_home",
        pessoa_phone_mobile: "pessoa_phone_mobile",
        pessoa_phone_other: "pessoa_phone_other",
        pessoa_telefone: "pessoa_telefone",
        pessoa_celular: "pessoa_celular",
        organizacao_nome: "organizacao_nome",
        organizacao_segmento: "organizacao_segmento",
        organizacao_tamanho_da_empresa: "organizacao_tamanho_da_empresa",
        negocio_status: "negocio_status",
        ddd: "ddd",
        uf: "uf",
        cidade_estimada: "cidade_estimada",
        fonte_localizacao: "fonte_localizacao",
        status_kanban: "status_kanban",
        cor_card: "cor_card",
        data_ultima_movimentacao: "data_ultima_movimentacao",
        impresso_lista: "impresso_lista",
        telefone_normalizado: "telefone_normalizado",
      },
    },
    layout_importacao_empresas: {
      tableName: "layout_importacao_empresas",
      onConflict: "cliente_id",
      mapping: {
        cliente_id: "cliente_id",
        nome_da_empresa: "nome_da_empresa",
        site_empresa: "site_empresa",
        pais_empresa: "pais_empresa",
        estado_empresa: "estado_empresa",
        cidade_empresa: "cidade_empresa",
        logradouro_empresa: "logradouro_empresa",
        numero_empresa: "numero_empresa",
        bairro_empresa: "bairro_empresa",
        complemento_empresa: "complemento_empresa",
        cep_empresa: "cep_empresa",
        cnpj_empresa: "cnpj_empresa",
        ddi_empresa: "ddi_empresa",
        telefones_empresa: "telefones_empresa",
        observacao_empresa: "observacao_empresa",
      },
    },
    leads_exact_spotter: {
      tableName: "leads_exact_spotter",
      onConflict: "cliente_id",
      mapping: {
        cliente_id: "cliente_id",
        nome_do_lead: "nome_do_lead",
        origem: "origem",
        sub_origem: "sub_origem",
        mercado: "mercado",
        produto: "produto",
        site: "site",
        pais: "pais",
        estado: "estado",
        cidade: "cidade",
        logradouro: "logradouro",
        numero: "numero",
        bairro: "bairro",
        complemento: "complemento",
        cep: "cep",
        ddi: "ddi",
        telefones: "telefones",
        observacao: "observacao",
        cpf_cnpj: "cpf_cnpj",
        nome_contato: "nome_contato",
        e_mail_contato: "e_mail_contato",
        cargo_contato: "cargo_contato",
        ddi_contato: "ddi_contato",
        telefones_contato: "telefones_contato",
        tipo_do_serv_comunicacao: "tipo_do_serv_comunicacao",
        id_do_serv_comunicacao: "id_do_serv_comunicacao",
        area: "area",
        nome_da_empresa: "nome_da_empresa",
        etapa: "etapa",
        funil: "funil",
        empresa_id: "empresa_id",
      },
    },
    perdecomp: {
      tableName: "perdecomp",
      onConflict: "cliente_id",
      mapping: {
        cliente_id: "cliente_id",
        nome_da_empresa: "nome_da_empresa",
        perdcomp_id: "perdcomp_id",
        cnpj: "cnpj",
        tipo_pedido: "tipo_pedido",
        situacao: "situacao",
        periodo_inicio: "periodo_inicio",
        periodo_fim: "periodo_fim",
        quantidade_perdcomp: "quantidade_perdcomp",
        numero_processo: "numero_processo",
        data_protocolo: "data_protocolo",
        ultima_atualizacao: "ultima_atualizacao",
        quantidade_receitas: "quantidade_receitas",
        quantidade_origens: "quantidade_origens",
        quantidade_dar_fs: "quantidade_dar_fs",
        url_comprovante_html: "url_comprovante_html",
        url_comprovante_pdf: "url_comprovante_pdf",
        data_consulta: "data_consulta",
        tipo_empresa: "tipo_empresa",
        concorrentes: "concorrentes",
        json_bruto: "json_bruto",
        empresa_id: "empresa_id",
        code: "code",
        code_message: "code_message",
        mapped_count: "mapped_count",
        perdcomp_principal_id: "perdcomp_principal_id",
        perdcomp_solicitante: "perdcomp_solicitante",
        perdcomp_tipo_documento: "perdcomp_tipo_documento",
        perdcomp_tipo_credito: "perdcomp_tipo_credito",
        perdcomp_data_transmissao: "perdcomp_data_transmissao",
        perdcomp_situacao: "perdcomp_situacao",
        perdcomp_situacao_detalhamento: "perdcomp_situacao_detalhamento",
        qtd_perdcomp_dcomp: "qtd_perdcomp_dcomp",
        qtd_perdcomp_rest: "qtd_perdcomp_rest",
        qtd_perdcomp_cancel: "qtd_perdcomp_cancel",
        qtd_perdcomp_ressarc: "qtd_perdcomp_ressarc",
      },
    },
    perdecomp_itens: {
      tableName: "perdecomp_itens",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        cliente_id: "cliente_id",
        empresa_id: "empresa_id",
        nome_da_empresa: "nome_da_empresa",
        cnpj: "cnpj",
        perdcomp_numero: "perdcomp_numero",
        perdcomp_formatado: "perdcomp_formatado",
        b1: "b1",
        b2: "b2",
        data_ddmmaa: "data_ddmmaa",
        data_iso: "data_iso",
        tipo_codigo: "tipo_codigo",
        tipo_nome: "tipo_nome",
        natureza: "natureza",
        familia: "familia",
        credito_codigo: "credito_codigo",
        credito_descricao: "credito_descricao",
        protocolo: "protocolo",
        situacao: "situacao",
        situacao_detalhamento: "situacao_detalhamento",
        motivo_normalizado: "motivo_normalizado",
        solicitante: "solicitante",
        fonte: "fonte",
        data_consulta: "data_consulta",
        url_comprovante_html: "url_comprovante_html",
      },
    },
    perdecomp_facts: {
      tableName: "perdecomp_facts",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        cliente_id: "cliente_id",
        empresa_id: "empresa_id",
        nome_da_empresa: "nome_da_empresa",
        cnpj: "cnpj",
        perdcomp_numero: "perdcomp_numero",
        perdcomp_formatado: "perdcomp_formatado",
        b1: "b1",
        b2: "b2",
        data_ddmmaa: "data_ddmmaa",
        data_iso: "data_iso",
        tipo_codigo: "tipo_codigo",
        tipo_nome: "tipo_nome",
        natureza: "natureza",
        familia: "familia",
        credito_codigo: "credito_codigo",
        credito_descricao: "credito_descricao",
        risco_nivel: "risco_nivel",
        protocolo: "protocolo",
        situacao: "situacao",
        situacao_detalhamento: "situacao_detalhamento",
        motivo_normalizado: "motivo_normalizado",
        solicitante: "solicitante",
        fonte: "fonte",
        data_consulta: "data_consulta",
        url_comprovante_html: "url_comprovante_html",
        row_hash: "row_hash",
        inserted_at: "inserted_at",
        consulta_id: "consulta_id",
        version: "version",
        deleted_flag: "deleted_flag",
      },
    },
    perdecomp_snapshot: {
      tableName: "perdecomp_snapshot",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        cliente_id: "cliente_id",
        empresa_id: "empresa_id",
        nome_da_empresa: "nome_da_empresa",
        cnpj: "cnpj",
        qtd_total: "qtd_total",
        qtd_dcomp: "qtd_dcomp",
        qtd_rest: "qtd_rest",
        qtd_ressarc: "qtd_ressarc",
        risco_nivel: "risco_nivel",
        risco_tags_json: "risco_tags_json",
        por_natureza_json: "por_natureza_json",
        por_credito_json: "por_credito_json",
        datas_json: "datas_json",
        primeira_data_iso: "primeira_data_iso",
        ultima_data_iso: "ultima_data_iso",
        resumo_ultima_consulta_json_p1: "resumo_ultima_consulta_json_p1",
        resumo_ultima_consulta_json_p2: "resumo_ultima_consulta_json_p2",
        card_schema_version: "card_schema_version",
        rendered_at_iso: "rendered_at_iso",
        fonte: "fonte",
        data_consulta: "data_consulta",
        url_comprovante_html: "url_comprovante_html",
        payload_bytes: "payload_bytes",
        last_updated_iso: "last_updated_iso",
        snapshot_hash: "snapshot_hash",
        facts_count: "facts_count",
        consulta_id: "consulta_id",
        erro_ultima_consulta: "erro_ultima_consulta",
      },
    },
    padroes: {
      tableName: "padroes",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        prudutos: "prudutos",
        mercados: "mercados",
        area: "area",
      },
    },
    historico_interacoes: {
      tableName: "historico_interacoes",
      onConflict: "message_id",
      mapping: {
        message_id: "message_id",
        cliente_id: "cliente_id",
        data_hora: "data_hora",
        tipo: "tipo",
        de_fase: "de_fase",
        para_fase: "para_fase",
        canal: "canal",
        observacao: "observacao",
        mensagem: "mensagem",
      },
    },
    mensagens: {
      tableName: "mensagens",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        titulo: "titulo",
        aplicativo: "aplicativo",
        mensagem: "mensagem",
      },
    },
    historico_whats_app: {
      tableName: "historico_whats_app",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        cliente_id: "cliente_id",
        numero: "numero",
        mensagem: "mensagem",
        direcao: "direcao",
        data_hora: "data_hora",
      },
    },
    usuarios: {
      tableName: "usuarios",
      onConflict: "usuario_id",
      mapping: {
        usuario_id: "usuario_id",
        nome: "nome",
        email: "email",
        hash_senha: "hash_senha",
        role: "role",
        ativo: "ativo",
        tentativas_login: "tentativas_login",
        bloqueado_ate: "bloqueado_ate",
        ultimo_login: "ultimo_login",
        criado_em: "criado_em",
        atualizado_em: "atualizado_em",
        token_reset: "token_reset",
        expira_reset: "expira_reset",
        teste_nova_coluna: "teste_nova_coluna",
        secret_word: "secret_word",
      },
    },
    dic_tipos: {
      tableName: "dic_tipos",
      onConflict: "tipo_codigo",
      mapping: {
        tipo_codigo: "tipo_codigo",
        tipo_nome: "tipo_nome",
      },
    },
    dic_naturezas: {
      tableName: "dic_naturezas",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        natureza: "natureza",
        familia: "familia",
        descricao: "descricao",
      },
    },
    dic_creditos: {
      tableName: "dic_creditos",
      onConflict: "credito_codigo",
      mapping: {
        credito_codigo: "credito_codigo",
        descricao: "descricao",
      },
    },
    dic_situacoes: {
      tableName: "dic_situacoes",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        situacao_original: "situacao_original",
        detalhe_original: "detalhe_original",
        motivo_normalizado: "motivo_normalizado",
      },
    },
    rotas: {
      tableName: "rotas",
      onConflict: "rota_codigo",
      mapping: {
        rota_codigo: "rota_codigo",
        rota_path: "rota_path",
        descricao: "descricao",
        ativa: "ativa",
      },
    },
    permissoes: {
      tableName: "permissoes",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        tipo: "tipo",
        rota: "rota",
        role: "role",
        visualizar: "visualizar",
        editar: "editar",
        excluir: "excluir",
        exportar: "exportar",
        enviar_crm: "enviar_crm",
        gerar_pdf: "gerar_pdf",
        enriquecer: "enriquecer",
        consultar_perdcomp: "consultar_perdcomp",
        ativo: "ativo",
        enviar_spotter: "enviar_spotter",
      },
    },
    vocab_permissoes: {
      tableName: "vocab_permissoes",
      onConflict: "chave",
      mapping: {
        chave: "chave",
        descricao: "descricao",
        escopo: "escopo",
        rota_padrao: "rota_padrao",
      },
    },
    roles_default: {
      tableName: "roles_default",
      onConflict: null, // PK é BIGSERIAL, usar insert
      mapping: {
        role: "role",
        rota: "rota",
        visualizar: "visualizar",
        editar: "editar",
        excluir: "excluir",
        exportar: "exportar",
        enviar_crm: "enviar_crm",
        gerar_pdf: "gerar_pdf",
        enriquecer: "enriquecer",
        consultar_perdcomp: "consultar_perdcomp",
      },
    },
    auditoria_acesso: {
      tableName: "auditoria_acesso",
      onConflict: "evento_id",
      mapping: {
        evento_id: "evento_id",
        usuario_email: "usuario_email",
        tipo_evento: "tipo_evento",
        origem_ip: "origem_ip",
        user_agent: "user_agent",
        data_hora: "data_hora",
        detalhes: "detalhes",
      },
    },
    auditoria_acao: {
      tableName: "auditoria_acao",
      onConflict: "evento_id",
      mapping: {
        evento_id: "evento_id",
        usuario_email: "usuario_email",
        rota: "rota",
        acao: "acao",
        sucesso: "sucesso",
        data_hora: "data_hora",
        payload_resumo: "payload_resumo",
      },
    },
    teses: {
      tableName: "teses",
      onConflict: "tese_id",
      mapping: {
        tese_id: "tese_id",
        tipo: "tipo",
        tema: "tema",
        tributo_do_credito: "tributo_do_credito",
        base_legal: "base_legal",
        contexto_do_direito: "contexto_do_direito",
        documentacao_necessaria: "documentacao_necessaria",
        informacoes_a_serem_analisadas: "informacoes_a_serem_analisadas",
        forma_de_utilizacao: "forma_de_utilizacao",
        publico_alvo: "publico_alvo",
        grau_de_risco: "grau_de_risco",
        status: "status",
        via: "via",
        grau_de_risco_judicial: "grau_de_risco_judicial",
      },
    },
    cnae: {
      tableName: "cnae",
      onConflict: "cnae_id",
      mapping: {
        cnae_id: "cnae_id",
        cnae: "cnae",
        desc_cnae: "desc_cnae",
      },
    },
  };

  // Executar a migração para cada aba/tabela
  for (const sheetKey in MAPPINGS) {
    const { tableName, onConflict, mapping } = MAPPINGS[sheetKey];
    await migrateTable(sheets, sheetKey, tableName, mapping, onConflict);
  }

  console.log("\nProcesso de migração finalizado.");
}

main();
