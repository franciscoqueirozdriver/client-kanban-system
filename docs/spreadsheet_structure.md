# Estrutura da Planilha Google Sheets

Este documento descreve as abas e os cabeçalhos exatos da planilha utilizada no sistema, servindo como referência para a migração e manutenção dos dados.

| Aba | Descrição | Principais Cabeçalhos |
| :--- | :--- | :--- |
| **sheet1** | Leads e Negócios | cliente_id, negocio_titulo, negocio_valor, negocio_etapa, negocio_mrr, etc. |
| **layout_importacao_empresas** | Dados de Empresas | cliente_id, nome_da_empresa, cnpj_empresa, site_empresa, etc. |
| **leads_exact_spotter** | Integração Spotter | cliente_id, nome_do_lead, origem, sub_origem, mercado, produto, etc. |
| **perdecomp** | Resumo PER/DCOMP | cliente_id, perdcomp_id, cnpj, situacao, periodo_inicio, etc. |
| **perdecomp_itens** | Itens Individuais | cliente_id, perdcomp_numero, tipo_nome, natureza, familia, etc. |
| **perdecomp_facts** | Fatos Processados | cliente_id, perdcomp_numero, risco_nivel, row_hash, consulta_id, etc. |
| **perdecomp_snapshot** | Snapshot Consolidado | cliente_id, qtd_total, risco_nivel, resumo_ultima_consulta_json, etc. |
| **padroes** | Configurações Padrão | prudutos, mercados, area |
| **historico_interacoes** | Logs de Interação | message_id, cliente_id, tipo, de_fase, para_fase, mensagem, etc. |
| **mensagens** | Templates de Mensagem | titulo, aplicativo, mensagem |
| **historico_whats_app** | Logs de WhatsApp | cliente_id, numero, mensagem, direcao, data_hora |
| **usuarios** | Gestão de Usuários | usuario_id, nome, email, hash_senha, role, ativo, etc. |
| **dic_tipos** | Dicionário de Tipos | tipo_codigo, tipo_nome |
| **dic_naturezas** | Dicionário de Naturezas | natureza, familia, descricao |
| **dic_creditos** | Dicionário de Créditos | credito_codigo, descricao |
| **dic_situacoes** | Dicionário de Situações | situacao_original, detalhe_original, motivo_normalizado |
| **rotas** | Definição de Rotas | rota_codigo, rota_path, descricao, ativa |
| **permissoes** | Matriz de Permissões | tipo, rota, role, visualizar, editar, excluir, etc. |
| **vocab_permissoes** | Vocabulário de Permissões | chave, descricao, escopo, rota_padrao |
| **roles_default** | Roles Padrão | role, rota, visualizar, editar, excluir, etc. |
| **auditoria_acesso** | Auditoria de Acesso | evento_id, usuario_email, tipo_evento, origem_ip, etc. |
| **auditoria_acao** | Auditoria de Ações | evento_id, usuario_email, rota, acao, sucesso, etc. |
| **teses** | Banco de Teses | tese_id, tipo, tema, tributo_do_credito, base_legal, etc. |
| **cnae** | Tabela CNAE | cnae_id, cnae, desc_cnae |

---

## Detalhes Técnicos
- **Formato de Data**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Deduplicação**: Baseada em chaves primárias (geralmente `cliente_id` ou `id` específicos).
- **Relacionamentos**: A maioria das tabelas possui chave estrangeira para `leads(cliente_id)`.
