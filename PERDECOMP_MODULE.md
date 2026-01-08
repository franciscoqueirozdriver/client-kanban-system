# Guia de Desenvolvimento: Módulo PER/DCOMP Comparativo

Este documento serve como guia para agentes de IA e desenvolvedores que trabalham no módulo de consulta e comparação de PER/DCOMP (`/consultas/perdecomp-comparativo`). Ele detalha a arquitetura, fluxos de dados, APIs e regras de negócio.

## 1. Visão Geral

O módulo **PER/DCOMP Comparativo** permite que o usuário consulte a situação de PER/DCOMP (Pedido Eletrônico de Restituição, Ressarcimento ou Reembolso e Declaração de Compensação) de uma empresa principal e compare com até 3 concorrentes.

**Objetivos Principais:**
*   Consultar dados via API da Infosimples (Receita Federal).
*   Persistir dados em planilhas Google Sheets (Snapshots e Fatos).
*   Utilizar IA (Perplexity) para enriquecimento de dados e busca de concorrentes.
*   Visualizar dados comparativos (quantitativos, natureza, riscos).

## 2. Arquitetura e Stack

*   **Frontend:** Next.js (App Router), React, Tailwind CSS.
*   **Backend:** API Routes (Next.js Serverless functions).
*   **Banco de Dados:** Google Sheets (via `googleapis`).
*   **Integrações Externas:**
    *   **Infosimples:** Consulta de dados da Receita Federal.
    *   **Perplexity AI:** Enriquecimento de dados e sugestão de concorrentes.

## 3. Estrutura do Frontend

O ponto de entrada é `app/consultas/perdecomp-comparativo/page.tsx`, que renderiza o componente principal.

### Componente Principal: `ClientPerdecompComparativo.tsx`

Gerencia todo o estado da aplicação:
*   **State:**
    *   `client`: Empresa principal selecionada.
    *   `competitors`: Array de concorrentes (máx 3).
    *   `results`: Resultados das consultas (Status, Dados, Erros).
    *   `startDate` / `endDate`: Período de consulta (padrão: últimos 5 anos).
*   **Fluxo de Consulta (`handleConsult` -> `runConsultation`):**
    1.  Valida CNPJ (`ensureValidCnpj`).
    2.  Verifica se é Matriz/Filial (`decideCNPJFinalBeforeQuery`).
    3.  Chama `/api/sheets/cnpj` para registrar o uso do CNPJ.
    4.  Chama `/api/perdecomp/snapshot` para ler os dados do snapshot (read-only).
    5.  Atualiza o estado `results` com os dados recebidos.

### Componentes Auxiliares
*   **`Autocomplete.tsx`**: Busca e seleção de empresas (usa `/api/clientes/buscar`).
*   **`PerdcompEnrichedCard.tsx`**: Exibe os dados processados (Resumo, Gráficos, Badges).
*   **`CompetitorSearchDialog.tsx`**: Modal para buscar concorrentes via IA (`/api/empresas/concorrentes`).
*   **`NewCompanyModal.tsx`**: Formulário para cadastrar novas empresas.
*   **`EnrichmentPreviewDialog.tsx`**: Mostra dados enriquecidos pela IA antes de salvar.

## 4. Estrutura do Backend (API Routes)

### 4.1. Leitura de Dados: `/api/perdecomp/snapshot`
**Arquivo:** `app/api/perdecomp/snapshot/route.ts`

Novo endpoint seguro ("blindado") para leitura de dados. Não realiza chamadas externas à Infosimples.

**Fluxo:**
1.  **Recebe Request:** `clienteId`, `cnpj`, `nomeEmpresa`.
2.  **Verifica Snapshot:** Tenta carregar dados salvos em `perdecomp_snapshot` via `lib/perdecomp-persist.ts`.
3.  **Fallback Legado:** Se não houver snapshot, tenta ler da aba `PERDECOMP` antiga.
4.  **Retorno:** Devolve JSON estruturado para o frontend ou um estado vazio seguro (não lança erro 502).

### 4.2. Core Legado (Descontinuado): `/api/infosimples/perdcomp`
**Arquivo:** `app/api/infosimples/perdcomp/route.ts`

**STATUS: DESCONTINUADO (Retorna 410 Gone)**.
Antigo endpoint responsável pela lógica principal de consulta. Foi desativado para impedir chamadas diretas à API externa que causavam instabilidade.

### 4.3. Persistência de CNPJ: `/api/sheets/cnpj`
**Arquivo:** `app/api/sheets/cnpj/route.ts`

Atualiza o CNPJ de um cliente em múltiplas abas (`Leads Exact Spotter`, `layout_importacao_empresas`, `Sheet1`) para garantir consistência.

### 4.3. IA e Enriquecimento
*   **`/api/empresas/concorrentes`**: Usa `lib/perplexity.ts` para listar concorrentes baseados no nome da empresa.
*   **`/api/empresas/enriquecer`**: Usa `lib/perplexity.ts` para buscar dados cadastrais completos (Endereço, Contato, CNAE, etc.).

### 4.4. Verificação: `/api/perdecomp/verificar`
Verifica a data da última consulta de um CNPJ na aba `PERDECOMP` para exibir alertas de "Cache recente".

## 5. Camada de Dados (Lib)

### 5.1. `lib/perdecomp-persist.ts`
Gerencia a gravação complexa no Google Sheets.
*   **Snapshot (`perdecomp_snapshot`):** Salva o JSON completo do card. Devido ao limite de células do Sheets, o JSON pode ser fragmentado em `shardP1` e `shardP2`.
*   **Facts (`perdecomp_facts`):** Salva cada item de PER/DCOMP como uma linha individual para análise analítica (BI).
*   **Hashing:** Gera hashes (`Row_Hash`, `Snapshot_Hash`) para evitar duplicatas.

### 5.2. `lib/googleSheets.js` (Legacy Wrapper)
Cliente de baixo nível para a API do Google Sheets.
*   Implementa cache em memória (`readCache`) para evitar rate limits.
*   Gerencia autenticação JWT.
*   Oferece funções utilitárias como `getSheetData`, `updateRowByIndex`.

### 5.3. `lib/perplexity.ts`
Abstração para chamadas à API da Perplexity.
*   Define prompts rigorosos para garantir retorno em JSON puro.
*   Funções: `enrichCompanyData`, `findCompetitors`.

## 6. Modelos de Dados

### Company (Interface Frontend)
```typescript
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string; // snake_case mandatório
  [key: string]: any;
}
```

### Snapshot Row (Google Sheets)
Colunas principais da aba `perdecomp_snapshot`:
*   `cliente_id`, `CNPJ`, `Qtd_Total`
*   `Resumo_Ultima_Consulta_JSON_P1/P2` (Payload JSON)
*   `Risco_Nivel`, `Risco_Tags_JSON`
*   `Snapshot_Hash`, `Data_Consulta`

## 7. Diretrizes de Desenvolvimento

1.  **Convenção de Nomes:** Use **`snake_case`** para propriedades de objetos que interagem com APIs e Planilhas. O código legado pode ter variações, mas novas implementações devem padronizar.
2.  **Tratamento de Erros:** APIs não devem quebrar (500) por falhas de terceiros. Use blocos `try/catch` e retorne estruturas de erro controladas ou valores padrão vazios.
3.  **Blindagem:** Não refatore lógica estrutural (ex: `lib/googleSheets.js`) a menos que estritamente necessário. Respeite os limites do escopo da tarefa.
4.  **Persistência Assíncrona:** A gravação no Sheets é pesada. O backend processa isso antes de retornar ao frontend, garantindo que o refresh da página mostre dados atualizados.
5.  **Validação de CNPJ:** Sempre normalize CNPJs (apenas números, 14 dígitos) antes de qualquer consulta ou gravação.

## 8. Comandos Úteis

*   **Rodar projeto:** `npm run dev`
*   **Lint:** `npm run lint` (ou `pnpm lint`)
*   **Testes:** `pnpm test`

---
*Este documento deve ser atualizado sempre que houver mudanças arquiteturais no módulo.*
