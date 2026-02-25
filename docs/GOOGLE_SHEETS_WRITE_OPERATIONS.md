# Mapeamento de Operações de Escrita - Google Sheets

Este documento lista todas as operações de escrita no Google Sheets identificadas no projeto. O objetivo é garantir que todas essas operações sejam espelhadas no Supabase antes da desativação das planilhas.

## 1. Funções de Escrita (Helpers)

As funções abaixo centralizam a lógica de escrita e estão localizadas em arquivos de biblioteca:

### `lib/googleSheets.js`
- **`updateRowByIndex({ sheetName, rowIndex, updates })`**: Atualiza colunas específicas em uma linha via `batchUpdate`.
- **`appendToSheets(payload)`**: Escrita tripla em `leads_exact_spotter`, `layout_importacao_empresas` e `sheet1`.
- **`appendSheetData(sheetName, rowsToAppend)`**: Inserção em massa de linhas em qualquer aba.
- **`updateRow(rowNumber, data)`**: Atalho para atualizar a aba `sheet1`.
- **`appendRow(data)`**: Atalho para inserir uma linha na aba `sheet1`.
- **`appendHistoryRow(data)`**: Atalho para inserir uma linha na aba `historico_interacoes`.
- **`updateInSheets(clienteId, payload)`**: Busca o `clienteId` e atualiza as 3 abas principais (`leads_exact_spotter`, `layout_importacao_empresas`, `sheet1`).
- **`appendCompanyImportRow(data)`**: Insere em `layout_importacao_empresas`.

### `lib/perdecomp-persist.ts`
- **`savePerdecompResults`**: Orquestra a gravação de dados fiscais.
- **`upsertSnapshot(row)`**: Grava o card JSON fatiado na aba `perdecomp_snapshot`.
- **`appendFactsBatched(rows)`**: Insere os itens individuais na aba `perdecomp_facts`.
- **`updateSnapshotFields`**: Atualiza metadados (como `Facts_Count` e erros) no snapshot.

### `lib/report.js`
- **`markPrintedRows(updateRowFn, rows)`**: Marca clientes como "Em Lista" na coluna `Impresso_Lista`.
- **`saveNormalizedPhones(updateRowFn, rowNum, numbers)`**: Salva telefones limpos na coluna `Telefone Normalizado`.

---

## 2. Mapeamento por Rota/Arquivo

| Arquivo | Aba(s) | Função Usada | Dados Gravados |
| :--- | :--- | :--- | :--- |
| `app/api/sheets/cor-card/route.ts` | `sheet1` | `sheet.addRow` | `CardId`, `Cor_Card`, `CreatedAt` |
| `app/api/sheets/cnpj/route.ts` | `sheet1`, `leads_exact_spotter`, `layout_importacao_empresas` | `updateRowByIndex` | Colunas de CNPJ (Empresa, Normalizado, Matriz, Raiz, Is_Matriz) |
| `app/api/infosimples/perdcomp/route.ts` | `PERDECOMP`, `perdecomp_snapshot`, `perdecomp_facts` | Direto / `savePerdecompResults` | Resumo fiscal e detalhes completos do card |
| `app/api/empresas/cadastrar/route.ts` | `sheet1`, `leads_exact_spotter`, `layout_importacao_empresas` | `appendToSheets`, `updateInSheets` | Dados cadastrais (Empresa, Contato, Comercial) |
| `app/api/perdecomp/salvar/route.ts` | `PERDECOMP` | `appendSheetData` | Itens de resumo PER/DCOMP |
| `app/api/clientes/registrar/route.ts` | `layout_importacao_empresas` | `appendSheetData` | Dados da empresa e `Cliente_ID` gerado |
| `pages/api/clientes.js` | `sheet1` | `updateRow`, `appendRow` | Dados de contato e organização |
| `pages/api/interacoes.js` | `historico_interacoes` | `appendHistoryRow` | Registro de atividade (tipo, data, fases, canal, obs) |
| `pages/api/teses.js` | `teses` | `sheet.addRow`, `targetRow.save` | Cadastro e atualização de teses tributárias |
| `pages/api/reports.js` | `sheet1` | `markPrintedRows` | Status `Impresso_Lista` |
| `pages/api/kanban.js` | `sheet1` | `updateRowByIndex` | `Status_Kanban`, `Cor_Card`, `Data_Ultima_Movimentacao` |
| `pages/api/corrigir-cor-card.js` | `sheet1` | `batchUpdate` | Correção manual da coluna `Cor_Card` |
| `pages/api/perdcomp/dicionario.js` | `DIC_TIPOS`, `DIC_NATUREZAS`, `DIC_CREDITOS` | `update`, `append` | Dicionários de mapeamento da Receita Federal |
| `pages/api/companies.js` | `layout_importacao_empresas` | `appendCompanyImportRow` | Dados enriquecidos via AI |
| `pages/api/migrar-clienteid.js` | Várias | `values.update` | Script técnico de migração de colunas |

---

## 3. Status da Migração (Supabase)

**Observação Crítica**: No momento do mapeamento, **nenhuma** das operações transacionais acima possui escrita equivalente no Supabase no código da aplicação.

As escritas no Supabase estão presentes apenas em:
1.  `app/api/admin/import-sheets/route.ts`: Grava logs de migração manual (`migration_logs`).
2.  `scripts/migrate-to-supabase.js`: Script de carga em massa.

Para desligar o Google Sheets, será necessário implementar chamadas `supabase.from(tabela).insert()` ou `.upsert()` em cada uma das rotas listadas na Seção 2.
