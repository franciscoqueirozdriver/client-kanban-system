# Resumo das Correções de Importação

## Problema Identificado

Após a refatoração de nomes de abas e colunas do Google Sheets, o build do Vercel apresentou múltiplos erros de importação em arquivos do novo diretório `app/api/`. Isso ocorreu porque:

1. **Funções faltantes**: Algumas funções que eram usadas nos arquivos `app/api/` não estavam sendo exportadas pelo `lib/googleSheets.js` após a refatoração.
2. **Nomes de abas hardcoded**: Vários arquivos ainda usavam strings literais para nomes de abas, em vez de usar a função `getSheetName()` para obter os nomes normalizados.

## Solução Implementada

### 1. Adicionar Funções Faltantes ao `lib/googleSheets.js`

Foram adicionadas as seguintes funções para manter compatibilidade com o código antigo:

- **`getSheetData(sheetName, range)`**: Retorna dados de uma aba específica no formato `{ headers, rows }`.
- **`appendSheetData(sheetName, data)`**: Adiciona dados a uma aba.
- **`updateInSheets(sheetName, rowNumber, data)`**: Atualiza dados em uma aba.
- **`findByCnpj(cnpj)`**: Encontra uma linha por CNPJ.
- **`findByName(name)`**: Encontra uma linha por nome.
- **`getNextClienteId()`**: Obtém o próximo ID de cliente.
- **`appendToSheets(sheetName, data)`**: Alias para `appendSheetData`.
- **`chunk(arr, size)`**: Divide um array em chunks.
- **`getSheetsClient()`**: Retorna o cliente do Google Sheets.
- **`withRetry`**: Exportada para compatibilidade.

### 2. Corrigir Importações nos Arquivos `app/api/`

#### `app/api/clientes/buscar/route.ts`
- ✅ Importar `getSheetName` do `lib/googleSheets.js`
- ✅ Usar `getSheetName('Leads Exact Spotter')` para obter o nome normalizado da aba

#### `app/api/clientes/registrar/route.ts`
- ✅ Importar `getSheetName` do `lib/googleSheets.js`
- ✅ Usar `getSheetName('layout_importacao_empresas')` para obter o nome normalizado da aba

#### `app/api/empresas/cadastrar/route.ts`
- ✅ Importar `getSheetName` do `lib/googleSheets.js`
- ✅ Adicionar constantes para nomes de abas normalizados:
  - `const SHEET_NAME = getSheetName('Sheet1');`
  - `const COMPANY_IMPORT_SHEET_NAME = getSheetName('layout_importacao_empresas');`

#### `app/api/perdecomp/salvar/route.ts`
- ✅ Importar `NextResponse` do `next/server`
- ✅ Importar `getSheetName` do `lib/googleSheets.js`
- ✅ Usar `getSheetName('PERDECOMP')` para obter o nome normalizado da aba

#### `app/api/perdecomp/verificar/route.ts`
- ✅ Importar `NextResponse` do `next/server`

### 3. Corrigir Importações em `lib/perdecomp-persist.ts`

- ✅ Importar `getSheetName` do `lib/googleSheets.js`
- ✅ Usar `getSheetName()` para normalizar os nomes de abas:
  - `export const SHEET_SNAPSHOT = getSheetName('perdecomp_snapshot');`
  - `export const SHEET_FACTS = getSheetName('perdecomp_facts');`
  - `const SHEET_FACTS_ERRORS = getSheetName('perdecomp_facts_errors');`
  - `const SHEET_DIC_CREDITOS = getSheetName('DIC_CREDITOS');`
  - `const SHEET_DIC_NATUREZA = getSheetName('DIC_NATUREZA');`

## Erros Corrigidos

### Antes da Correção

```
Attempted import error: 'getSheetData' is not exported from '../../../../lib/googleSheets.js'
Attempted import error: 'appendSheetData' is not exported from '../../../../lib/googleSheets.js'
Attempted import error: 'updateInSheets' is not exported from '../../../../lib/googleSheets'
Attempted import error: 'findByCnpj' is not exported from '../../../../lib/googleSheets'
Attempted import error: 'findByName' is not exported from '../../../../lib/googleSheets'
Attempted import error: 'getNextClienteId' is not exported from '../../../../lib/googleSheets'
Attempted import error: 'appendToSheets' is not exported from '../../../../lib/googleSheets'
Attempted import error: 'getSheetsClient' is not exported from './googleSheets.js'
Attempted import error: 'chunk' is not exported from './googleSheets.js'
Attempted import error: 'withRetry' is not exported from './googleSheets.js'
```

### Depois da Correção

✅ Todas as funções agora são exportadas e disponíveis para importação.
✅ Todos os nomes de abas são normalizados usando `getSheetName()`.
✅ Build do Vercel deve passar sem erros de importação.

## Arquivos Modificados

1. `lib/googleSheets.js` - Adicionadas funções faltantes
2. `app/api/clientes/buscar/route.ts` - Corrigidas importações
3. `app/api/clientes/registrar/route.ts` - Corrigidas importações
4. `app/api/empresas/cadastrar/route.ts` - Corrigidas importações
5. `app/api/perdecomp/salvar/route.ts` - Corrigidas importações
6. `app/api/perdecomp/verificar/route.ts` - Corrigidas importações
7. `lib/perdecomp-persist.ts` - Corrigidas importações

## Próximos Passos

1. Executar o build do Vercel novamente para confirmar que todos os erros foram corrigidos.
2. Testar os endpoints de API para garantir que funcionam corretamente com os nomes de abas normalizados.
3. Fazer merge do Pull Request após aprovação.

## Observações

- A refatoração mantém compatibilidade com o código antigo através das funções de compatibilidade adicionadas.
- Todos os nomes de abas agora são normalizados através da função `getSheetName()`.
- As credenciais do Google Sheets não foram alteradas.
- A lógica de negócio foi mantida intacta.

