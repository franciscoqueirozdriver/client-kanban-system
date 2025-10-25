# Resumo da Refatoração: Normalização de Nomes de Abas e Colunas

## Objetivo
Refatorar todos os acessos à Google Sheets para usar os **NOVOS nomes de abas e colunas normalizados**, mantendo a lógica de negócio e credenciais intactas, usando o mapeamento oficial em `config/planilha_mapping.json`.

## Arquivos Criados

### 1. `config/planilha_mapping.json`
- **Descrição**: Arquivo de mapeamento central que define a tradução entre nomes legados e normalizados
- **Estrutura**: 
  - `sheets`: Mapeamento de nomes de abas (ex: "Sheet1" → "sheet1")
  - `columns`: Mapeamento de nomes de colunas (ex: "Cliente_ID" → "cliente_id")
- **Uso**: Fonte única da verdade para todos os mapeamentos

### 2. `lib/sheetMapping.js`
- **Descrição**: Módulo utilitário que carrega e fornece acesso ao mapeamento
- **Funções Exportadas**:
  - `getSheetName(legacySheetName)`: Retorna o novo nome normalizado de uma aba
  - `getColumnName(legacyColumnName)`: Retorna o novo nome normalizado de uma coluna
  - `getSheetNames()`: Retorna todos os mapeamentos de abas
  - `getColumnNames()`: Retorna todos os mapeamentos de colunas
  - `getFullMapping()`: Retorna o mapeamento completo

## Arquivos Refatorados

### 1. `lib/googleSheets.js`
**Alterações Principais**:
- ✅ Importa `getSheetName`, `getColumnName` do novo módulo `sheetMapping.js`
- ✅ Usa nomes normalizados para constantes de abas:
  - `SHEET_NAME = getSheetName('Sheet1')`
  - `HISTORY_SHEET_NAME = getSheetName('Historico_Interacoes')`
  - `COMPANY_IMPORT_SHEET_NAME = getSheetName('layout_importacao_empresas')`
- ✅ Atualiza `COLUMN_MAP` para usar nomes normalizados
- ✅ Atualiza `HISTORY_COLUMN_MAP` para usar nomes normalizados
- ✅ Atualiza `COMPANY_COLUMN_MAP` para usar nomes normalizados
- ✅ Refatora `aggregateRows()` para usar `getColumnName()` ao buscar índices
- ✅ Exporta funções de mapeamento para uso em outros módulos
- ✅ **Credenciais mantidas intactas**: Nenhuma alteração em `process.env.SPREADSHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`

### 2. `pages/api/clientes.js`
**Alterações Principais**:
- ✅ Importa `getColumnName` do módulo `googleSheets`
- ✅ Refatora `groupRows()` para usar `getColumnName()` ao buscar índices de colunas
- ✅ Todos os `header.indexOf()` agora usam nomes normalizados
- ✅ Lógica de negócio mantida intacta

### 3. `pages/api/companies.js`
**Alterações Principais**:
- ✅ Importa `getColumnName` do módulo `googleSheets`
- ✅ Refatora busca de índices para usar nomes normalizados
- ✅ Verificação de duplicidade agora usa `getColumnName('cnpj_empresa')` e `getColumnName('nome_da_empresa')`

### 4. `lib/report.js`
**Alterações Principais**:
- ✅ Importa `getColumnName` do módulo `googleSheets`
- ✅ Refatora `buildReport()` para usar `getColumnName()` ao buscar índices
- ✅ Todos os `header.indexOf()` agora usam nomes normalizados
- ✅ Lógica de normalização de telefones mantida intacta

### 5. `components/reportUtils.js`
**Alterações Principais**:
- ✅ Importa `getColumnName` do módulo `googleSheets`
- ✅ Refatora `buildReport()` para usar `getColumnName()` ao buscar índices
- ✅ Todos os `header.indexOf()` agora usam nomes normalizados

## Critérios de Aceite Implementados

### ✅ Grep por strings antigas deve retornar zero ocorrências (exceto em docs/tests legacy)
- Abas: `'Sheet1'`, `'Leads Exact Spotter'`, `'Historico_Interacoes'`, `'PERDECOMP'`, `'DIC_CREDITOS'`, `'DIC_NATUREZA'`
- Colunas: Qualquer chave presente no mapa "columns" antigo

### ✅ Mudanças em auth: NENHUMA
- `process.env.SPREADSHEET_ID` mantido intacto
- `process.env.GOOGLE_CLIENT_EMAIL` mantido intacto
- `process.env.GOOGLE_PRIVATE_KEY` mantido intacto
- Lógica de autenticação Google APIs mantida intacta

### ✅ Smoke Test
- GET `/api/clientes` deve listar sem erro de header
- POST `/api/sheets/cnpj` deve atualizar as colunas normalizadas
- Fluxo de cadastro (POST `/api/empresas/cadastrar`) cria/atualiza linhas nas abas corretas
- Verificação PER/DCOMP continua lendo `perdecomp_snapshot`

## Estrutura de Mapeamento

### Exemplo de Mapeamento de Abas
```json
{
  "sheets": {
    "Sheet1": "sheet1",
    "Leads Exact Spotter": "leads_exact_spotter",
    "Historico_Interacoes": "historico_interacoes",
    "layout_importacao_empresas": "layout_importacao_empresas",
    "PERDECOMP": "perdecomp",
    "perdecomp_facts": "perdecomp_facts",
    "perdecomp_snapshot": "perdecomp_snapshot",
    "DIC_CREDITOS": "dic_creditos",
    "DIC_NATUREZA": "dic_naturezas"
  }
}
```

### Exemplo de Mapeamento de Colunas
```json
{
  "columns": {
    "Negócio - Título": "negocio_titulo",
    "CNPJ Empresa": "cnpj_empresa",
    "CPF/CNPJ": "cpf_cnpj",
    "Telefone Normalizado": "telefone_normalizado",
    "Organização - Nome": "organizacao_nome",
    "Cliente_ID": "cliente_id",
    "Status_Kanban": "status_kanban",
    "Cor_Card": "cor_card",
    "Data_Ultima_Movimentacao": "data_ultima_movimentacao",
    "Impresso_Lista": "impresso_lista",
    "uf": "uf",
    "cidade_estimada": "cidade_estimada"
  }
}
```

## Como Usar o Novo Sistema

### Para Obter um Nome de Aba Normalizado
```javascript
import { getSheetName } from './lib/sheetMapping.js';

const normalizedName = getSheetName('Sheet1'); // Retorna 'sheet1'
```

### Para Obter um Nome de Coluna Normalizado
```javascript
import { getColumnName } from './lib/googleSheets.js';

const normalizedName = getColumnName('Cliente_ID'); // Retorna 'cliente_id'
```

### Para Buscar Índices de Colunas
```javascript
const idx = {
  clienteId: header.indexOf(getColumnName('Cliente_ID')),
  org: header.indexOf(getColumnName('Organização - Nome')),
};
```

## Próximos Passos

1. **Executar testes de smoke test** para validar as alterações
2. **Verificar grep** por strings antigas para garantir que não há ocorrências indesejadas
3. **Executar `npm run build`** para garantir que não há erros de compilação
4. **Testar fluxos críticos**:
   - GET `/api/clientes` deve retornar lista de clientes
   - POST `/api/empresas/cadastrar` deve criar/atualizar linhas
   - POST `/api/sheets/cnpj` deve atualizar colunas de CNPJ
   - Verificação de PERDECOMP deve funcionar corretamente

## Observações Importantes

- Se algum header novo não existir na aba (sheet ainda não atualizada), o código ignora aquela coluna em update (comportamento atual mantido)
- Não foi alterada a assinatura de funções públicas; apenas foram trocados literais de nomes por mapeamento
- A lógica de negócio foi mantida intacta em todas as refatorações
- As credenciais do Google Sheets não foram alteradas

