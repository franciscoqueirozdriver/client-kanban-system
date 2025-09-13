export const TARGET_SCHEMA = {
  Usuarios: [
    "Usuario_ID","Nome","Email","Hash_Senha","Role","Ativo",
    "Tentativas_Login","Bloqueado_Ate","Ultimo_Login",
    "Criado_Em","Atualizado_Em","Token_Reset","Expira_Reset"
  ],
  Rotas: [
    "Rota_Codigo","Rota_Path","Descricao","Ativa"
  ],
  // Opção A (padrão): ações especiais na própria Permissoes
  Permissoes: [
    "tipo","rota","role","visualizar","editar","excluir","exportar",
    "enviar_crm","gerar_pdf","enriquecer","consultar_perdcomp","ativo"
  ],
  // Opção B (granular — apenas reportar se não usar agora)
  Permissoes_Acoes: ["rota","acao_custom","role","permitido","ativo"],
  Vocab_Permissoes: ["chave","descricao","escopo","rota_padrao"],
  Roles_Default: [
    "role","rota","visualizar","editar","excluir","exportar",
    "enviar_crm","gerar_pdf","enriquecer","consultar_perdcomp"
  ],
  Auditoria_Acesso: [
    "Evento_ID","Usuario_Email","Tipo_Evento","Origem_IP","User_Agent","Data_Hora","Detalhes"
  ],
  Auditoria_Acao: [
    "Evento_ID","Usuario_Email","Rota","Acao","Sucesso","Data_Hora","Payload_Resumo"
  ]
};
