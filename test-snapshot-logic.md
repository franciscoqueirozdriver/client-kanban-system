# Teste Manual da Correção - PER/DCOMP Snapshot

## Cenário de Teste

### Pré-requisitos
1. Ter empresas com consultas já realizadas (ex: Bomix, Klabin, Eldorado, Globoplast)
2. Essas empresas devem ter dados na aba `perdecomp_snapshot`

### Teste 1: Consulta SEM nova busca (checkbox desmarcada)

**Passos:**
1. Acessar a página de consultas PER/DCOMP
2. Digitar o nome de uma empresa já consultada (ex: "Bomix")
3. Sistema detecta que já existe consulta anterior
4. **NÃO marcar** o checkbox "fazer nova consulta"
5. Clicar em "Consultar"

**Resultado Esperado:**
- ✅ Zero chamadas à API (verificar Network tab)
- ✅ Log no console: `SNAPSHOT_MODE` com source: 'perdecomp_snapshot'
- ✅ Log no console: `SNAPSHOT_ROWS` com contagem de registros
- ✅ Card exibe informações COMPLETAS:
  - Totais por família (DCOMP, REST, RESSARC, CANC)
  - Totais por natureza agrupada
  - Informações do primeiro registro (tipo_documento, situacao, etc.)
  - Data da última consulta
  - Link do site_receipt (se disponível)
  - Códigos PER/DCOMP (se disponíveis)

**Resultado Atual (BUG - antes da correção):**
- ❌ Card exibia apenas totais básicos
- ❌ Faltavam: primeiro registro, detalhes, códigos

### Teste 2: Consulta COM nova busca (checkbox marcada)

**Passos:**
1. Acessar a página de consultas PER/DCOMP
2. Digitar o nome de uma empresa
3. **MARCAR** o checkbox "fazer nova consulta"
4. Clicar em "Consultar"

**Resultado Esperado:**
- ✅ Chamada à API InfoSimples
- ✅ Atualização da aba `perdecomp_snapshot`
- ✅ Card exibe informações COMPLETAS da nova consulta

### Teste 3: Empresa com mappedCount = 0

**Passos:**
1. Consultar empresa sem PER/DCOMP (ex: Eldorado)
2. **NÃO marcar** checkbox para nova consulta

**Resultado Esperado:**
- ✅ Card é renderizado (não desaparece)
- ✅ Mensagem informativa: "Nenhum PER/DCOMP encontrado"
- ✅ Exibe data da última consulta

### Teste 4: Múltiplas empresas (cliente + concorrentes)

**Passos:**
1. Adicionar cliente principal e 3 concorrentes
2. Todas já consultadas anteriormente
3. **NÃO marcar** checkbox para nenhuma
4. Consultar todas

**Resultado Esperado:**
- ✅ Todos os cards exibem dados completos
- ✅ Zero chamadas à API
- ✅ Performance rápida (sem espera de API)

## Logs Esperados no Console

```
SNAPSHOT_MODE { empresa: 'Bomix', clienteId: 'CLT-XXXX', source: 'perdecomp_snapshot' }
SNAPSHOT_ROWS { empresa: 'Bomix', clienteId: 'CLT-XXXX', count: 15 }
```

## Verificação de Dados

### Campos que DEVEM estar presentes no card:
- `mappedCount` ou contagem de registros
- `total_perdcomp`
- `perdcompResumo.total`
- `perdcompResumo.totalSemCancelamento`
- `perdcompResumo.porFamilia` (DCOMP, REST, RESSARC, CANC)
- `perdcompResumo.porNaturezaAgrupada`
- `primeiro` (objeto com detalhes do primeiro registro)
- `header.requested_at` (data da consulta)
- `site_receipt` (link, se disponível)
- `perdcompCodigos` (array de códigos)

### Campos que NÃO devem faltar:
- ❌ Não deve retornar apenas totais básicos
- ❌ Não deve usar dados da aba `PERDECOMP` (antiga)
- ❌ Não deve usar dados da aba `perdecomp_facts`
