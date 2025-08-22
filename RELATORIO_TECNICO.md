# Relatório Técnico: Padronização de Cliente_ID e Mapeamento de Fluxo

**Autor:** Jules
**Data:** 2025-08-22
**Objetivo:** Este relatório documenta o mapeamento do fluxo de consulta PER/DCOMP, a implementação de um sistema determinístico para geração de `Cliente_ID` de concorrentes e as verificações realizadas para garantir a consistência dos dados, conforme solicitado.

---

## 1. Mapa do Fluxo (Ponta a Ponta)

O processo de consulta e gravação de dados PER/DCOMP foi mapeado e envolve uma interação entre o frontend, um endpoint de orquestração no backend e o Google Sheets.

**Fluxo Detalhado:**

1.  **Iniciação (Frontend):**
    *   **Arquivo:** `app/consultas/perdecomp-comparativo/page.tsx`
    *   **Ação:** O usuário utiliza a interface para selecionar um "Cliente Principal" e até três "Concorrentes". A seleção é feita através de um componente de autocompletar.
    *   **Geração de ID (Ponto da Modificação):** Ao confirmar a seleção de concorrentes através da caixa de diálogo "Pesquisar Concorrentes", a função `confirmCompetitors` é acionada. É neste ponto que a nova lógica de `Cliente_ID` foi injetada.

2.  **Verificação e Geração de ID (Frontend + Backend API):**
    *   **Arquivo Frontend:** `app/consultas/perdecomp-comparativo/page.tsx` (na função `confirmCompetitors`)
    *   **Endpoint Backend:** `app/api/clientes/buscar/route.ts` (novo)
    *   **Ação:**
        *   Para cada concorrente selecionado, o frontend agora faz uma chamada `GET` para `/api/clientes/buscar` passando o CNPJ e o nome.
        *   O backend busca na planilha (usando `findByCnpj` e `findByName` de `lib/googleSheets.js`) por um registro existente.
        *   **Se encontrado**, a API retorna o `Cliente_ID` existente, que é reutilizado pelo frontend.
        *   **Se não encontrado (404)**, o frontend chama a função `gerarClienteIdDeterministico` do novo arquivo `utils/clienteId.ts` para criar um ID padronizado.

3.  **Consulta PER/DCOMP (Frontend -> Backend):**
    *   **Arquivo Frontend:** `app/consultas/perdecomp-comparativo/page.tsx` (na função `runConsultation`)
    *   **Endpoint Backend:** `app/api/infosimples/perdcomp/route.ts`
    *   **Ação:** O frontend envia o `Cliente_ID` (seja ele reutilizado ou recém-gerado), o CNPJ e o período para o endpoint `/api/infosimples/perdcomp`.

4.  **Orquestração e Persistência (Backend):**
    *   **Arquivo:** `app/api/infosimples/perdcomp/route.ts`
    *   **Ação:**
        *   O endpoint primeiro verifica se existe um resultado recente na planilha para o `Cliente_ID` ou CNPJ (cache).
        *   Se não houver cache ou se a consulta for forçada, ele chama a API externa da Infosimples.
        *   Após receber a resposta, ele **grava os dados na aba `PERDECOMP` do Google Sheets**.
        *   **Método de Escrita:** A lógica verifica se já existe uma linha com o `Cliente_ID`. Se sim, usa `batchUpdate` para atualizar os dados. Se não, usa `append` para criar uma nova linha. Esta lógica foi mantida, pois se adequa perfeitamente à nova padronização de ID.

---

## 2. Contrato de Dados (Aba `PERDECOMP`)

A escrita na aba `PERDECOMP` é governada por um conjunto de cabeçalhos definidos no backend.

*   **Arquivo de Definição:** `app/api/infosimples/perdcomp/route.ts`
*   **Array de Cabeçalhos:** `REQUIRED_HEADERS`
*   **Ordem e Nomes das Colunas:**
    1.  `Cliente_ID`
    2.  `Nome da Empresa`
    3.  `Perdcomp_ID`
    4.  `CNPJ`
    5.  `Tipo_Pedido`
    6.  `Situacao`
    7.  `Periodo_Inicio`
    8.  `Periodo_Fim`
    9.  `Quantidade_PERDCOMP`
    10. `Numero_Processo`
    11. `Data_Protocolo`
    12. `Ultima_Atualizacao`
    13. `Quantidade_Receitas`
    14. `Quantidade_Origens`
    15. `Quantidade_DARFs`
    16. `URL_Comprovante_HTML`
    17. `URL_Comprovante_PDF`
    18. `Data_Consulta`
    19. `Tipo_Empresa`
    20. `Concorrentes`
    21. `Code`
    22. `Code_Message`
    23. `MappedCount`
    24. `Perdcomp_Principal_ID`
    25. `Perdcomp_Solicitante`
    26. `Perdcomp_Tipo_Documento`
    27. `Perdcomp_Tipo_Credito`
    28. `Perdcomp_Data_Transmissao`
    29. `Perdcomp_Situacao`
    30. `Perdcomp_Situacao_Detalhamento`

---

## 3. Regra do Cliente_ID (Determinístico)

A nova regra garante que concorrentes tenham um `Cliente_ID` padronizado e reutilizável, enquanto IDs de clientes existentes (ex: `CLT-XXXX`) não são afetados.

*   **Arquivo de Implementação:** `utils/clienteId.ts`
*   **Ponto de Integração:** `app/consultas/perdecomp-comparativo/page.tsx`

**Pseudocódigo da Lógica:**

```typescript
// Função para normalizar o nome da empresa
function normalizarNomeEmpresa(nome: string): string {
  // Remove acentos, espaços e pontuação, mantém [A-Za-z0-9]
  // Limita o tamanho para 40 caracteres
  const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  return slug || 'EmpresaSemNome';
}

// Função principal para gerar o ID
function gerarClienteIdDeterministico({ cnpj, nome }): string {
  if (cnpj && isValidCNPJ(cnpj)) {
    return `COMP-${cnpj}`; // Formato: COMP-08902291000115
  }
  const nomeNormalizado = normalizarNomeEmpresa(nome);
  return `COMP-${nomeNormalizado}`; // Formato: COMP-SaloboMetaisSA
}

// Lógica de integração no Frontend
async function obterIdParaConcorrente(concorrente) {
  // 1. Tenta buscar o concorrente na planilha via API
  const response = await fetch(`/api/clientes/buscar?cnpj=${concorrente.cnpj}&nome=${concorrente.nome}`);

  if (response.ok) {
    const { empresa } = await response.json();
    return empresa.Cliente_ID; // 2. Reutiliza o ID existente
  } else {
    // 3. Se não existe, gera um novo ID determinístico
    return gerarClienteIdDeterministico(concorrente);
  }
}
```

---

## 4. Cenários de Teste

Os seguintes cenários foram considerados durante a implementação e a lógica atual os cobre da seguinte forma:

**A) Cliente existente com Cliente_ID conhecido (ex: `CLT-0556`)**
*   **Resultado:** Nenhuma alteração. A lógica de modificação de ID só se aplica ao fluxo de adição de concorrentes. Clientes principais e seus IDs não são tocados.

**B) Concorrente com CNPJ válido (novo)**
*   **Resultado:** O `Cliente_ID` gerado será `COMP-<CNPJ>`. Ex: `COMP-08902291000115`.

**C) Concorrente sem CNPJ válido (novo)**
*   **Resultado:** O `Cliente_ID` gerado será `COMP-<NomeNormalizado>`. Ex: `COMP-EmpresaXPTO`.

**D) Reexecução para o mesmo concorrente**
*   **Resultado:** A API `/api/clientes/buscar` encontrará o registro previamente salvo (por CNPJ ou nome) e retornará o `Cliente_ID` já existente, que será reutilizado. Nenhum novo ID será criado.

**E) Dados com CNPJ formatado (ex: com apóstrofo '08.79...`)**
*   **Resultado:** As funções de normalização (`padCNPJ14` e `onlyDigits`) já existentes no código são usadas para limpar e padronizar o CNPJ antes de qualquer operação, garantindo que a busca e a geração de ID funcionem corretamente.

---

## 5. Pontos de Risco e Mitigações

*   **Risco: Duplicidade de `Cliente_ID` por inconsistência de nome.**
    *   **Mitigação:** A busca por CNPJ é sempre prioritária, pois é um identificador único. A busca por nome só ocorre se o CNPJ não estiver disponível ou não for encontrado. A normalização do nome (`normalizarNomeEmpresa`) reduz a chance de duplicatas baseadas em nomes com pequenas variações.

*   **Risco: Condição de corrida (Race Condition) se dois usuários adicionarem o mesmo concorrente ao mesmo tempo.**
    *   **Mitigação:** O risco é baixo, mas existe. No pior caso, dois `Cliente_ID`s poderiam ser gerados para a mesma empresa se a geração ocorrer antes da escrita na planilha ser concluída por ambos os usuários. A mitigação completa exigiria um bloqueio de transação (complexo com Google Sheets). A abordagem atual (busca-antes-de-gerar) mitiga significativamente este risco em cenários de uso normal.

*   **Risco: Alteração acidental de IDs de clientes.**
    *   **Mitigação:** A lógica implementada está estritamente contida no fluxo de adição de concorrentes (`confirmCompetitors`). Ela não interfere com a seleção ou o tratamento do cliente principal.

---

## 6. Lista de Alterações (Diff Minimalista)

As alterações foram focadas em três áreas, mantendo o resto do código intacto.

**1. Novo Arquivo: `utils/clienteId.ts`**
*   Adicionadas as funções `normalizarNomeEmpresa` e `gerarClienteIdDeterministico`.

```typescript
// utils/clienteId.ts
import { padCNPJ14, isValidCNPJ } from './cnpj';

export function normalizarNomeEmpresa(nome: string): string { /* ... */ }
export function gerarClienteIdDeterministico(empresa: { cnpj?: string | null; nome: string; }): string { /* ... */ }
```

**2. Novo Arquivo: `app/api/clientes/buscar/route.ts`**
*   Criado um novo endpoint `GET` para buscar clientes por CNPJ ou nome.

```typescript
// app/api/clientes/buscar/route.ts
import { NextResponse } from 'next/server';
import { findByCnpj, findByName } from '../../../../lib/googleSheets.js';

export async function GET(request: Request) { /* ... */ }
```

**3. Modificação: `app/consultas/perdecomp-comparativo/page.tsx`**
*   Importado o novo helper.
*   A função `confirmCompetitors` foi transformada em `async` e sua lógica interna foi substituída para usar o fluxo de busca-ou-geração.

```diff
// app/consultas/perdecomp-comparativo/page.tsx
- import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
+ import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
+ import { gerarClienteIdDeterministico } from '../../../../utils/clienteId';

- function confirmCompetitors(selected: Array<{ nome:string; cnpj:string }>) {
-   // Lógica antiga com ID não-determinístico
- }
+ async function confirmCompetitors(selected: Array<{ nome: string; cnpj: string }>) {
+   // Nova lógica com chamada à API /api/clientes/buscar e geração determinística
+ }
```
