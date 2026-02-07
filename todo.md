# Sistema de Inteligência Comercial - TODO

## Funcionalidades Obrigatórias

### Estrutura de Dados
- [x] Definir schema de Teses Tributárias no Supabase
- [x] Definir schema de PER/DCOMP no Supabase
- [x] Definir schema de Concorrentes no Supabase
- [x] Criar migrações Drizzle para Supabase

### Página PER/DCOMP Comparativo
- [x] Criar layout da página com seção de parâmetros
- [x] Implementar filtro por Nome/CNPJ
- [x] Implementar filtro por período (data início/fim)
- [x] Implementar botão "Consultar/Atualizar Comparação"
- [x] Implementar busca de concorrentes
- [x] Implementar adição de concorrentes manualmente
- [x] Exibir resultados da comparação
- [x] Integração com API de dados

### Página de Teses Tributárias
- [x] Criar layout da página com listagem em cards
- [x] Implementar filtro por Status (Ativas/Inativas)
- [x] Implementar filtro por Risco (Remoto/Baixo/Médio/Alto)
- [x] Implementar busca por ID/tema/tipo
- [x] Implementar botão "Nova Tese"
- [x] Implementar modal de detalhes de tese
- [x] Implementar ativação/desativação de teses
- [x] Exibir contadores (Total, Ativas, Inativas, Risco Remoto)

### Formulário de Nova Tese
- [x] Criar modal/página de criação de tese
- [x] Campo: Tributo
- [x] Campo: Tipo
- [x] Campo: Público-Alvo
- [x] Campo: Grau de Risco
- [x] Campo: Base Legal
- [x] Campo: Contexto do Direito
- [x] Campo: Tributo do Crédito
- [x] Campo: Documentação Necessária
- [x] Campo: Informações a Serem Analisadas
- [x] Campo: Forma de Utilização
- [x] Validação e salvamento

### Integração Supabase
- [x] Configurar conexão com Supabase
- [x] Implementar queries para teses
- [x] Implementar queries para PER/DCOMP
- [x] Implementar queries para concorrentes
- [x] Implementar mutations para criar/atualizar/deletar

### Exportação de Dados
- [x] Criar exportador de teses para JSON
- [x] Criar exportador de PER/DCOMP para JSON
- [x] Criar exportador de concorrentes para JSON
- [x] Implementar download de arquivo

### Importação de Dados
- [x] Criar importador de teses de JSON
- [x] Criar importador de PER/DCOMP de JSON
- [x] Criar importador de concorrentes de JSON
- [x] Validação de dados durante importação
- [x] Tratamento de erros e feedback ao usuário

### Testes
- [ ] Testes unitários para procedures tRPC
- [ ] Testes de validação de dados
- [ ] Testes de exportação/importação
- [ ] Testes de integração das páginas

## Notas de Implementação
- Usar Supabase como banco de dados principal
- Manter compatibilidade com estrutura de dados original
- Implementar UI profissional para sistema de gestão tributária
- Usar componentes shadcn/ui para consistência
