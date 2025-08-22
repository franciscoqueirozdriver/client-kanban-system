# Relatório Técnico PER/DCOMP

## Fluxo Geral
1. **Consulta PER/DCOMP**  
   - Arquivo: `app/api/infosimples/perdcomp/route.ts`  
   - Entrada: `cnpj`, intervalo de datas, `Cliente_ID` e `Nome_da_Empresa`.  
   - Saída: objeto JSON com dados da consulta e campos mapeados.  
   - Escrita: atualização ou append na aba `PERDECOMP` via Google Sheets API (`values.batchUpdate` ou `values.append`).
2. **Enriquecimento de concorrentes**  
   - Arquivo: `lib/perplexity.ts`  
   - Funções `findCompetitors` e `enrichCompanyData` consultam a API do Perplexity e retornam dados estruturados da empresa.  
   - Campos mapeados: `Empresa`, `Contato` e `Comercial`.
3. **Gravação nas abas**  
   - Arquivo: `lib/googleSheets.js`  
   - Funções `appendToSheets`, `appendSheetData` e `updateInSheets` escrevem nas abas `Leads Exact Spotter`, `layout_importacao_empresas`, `Sheet1` e `PERDECOMP` utilizando `values.append` ou `values.update`.

## Contrato de Dados
- **Aba PERDECOMP** (`app/api/perdecomp/salvar/route.ts`)  
  Colunas: `Cliente_ID`, `Nome da Empresa`, `Perdcomp_ID`, `CNPJ`, `Tipo_Pedido`, `Situacao`, `Periodo_Inicio`, `Periodo_Fim`, `Valor_Total`, `Numero_Processo`, `Data_Protocolo`, `Ultima_Atualizacao`, `Quantidade_Receitas`, `Quantidade_Origens`, `Quantidade_DARFs`, `URL_Comprovante_HTML`, `URL_Comprovante_PDF`, `Data_Consulta`.
- **Demais abas** seguem o mapeamento existente em `lib/googleSheets.js` (`buildLeadsExactSpotterRow`, `buildLayoutImportacaoRow`, `buildSheet1Row`).

## Padronização do `Cliente_ID`
- Helper: `utils/clienteId.ts`
- Regras:  
  ```ts
  if (cnpj && /^\d{14}$/.test(cnpj)) return `COMP-${cnpj}`;
  const slug = normalizarNomeEmpresa(nome);
  return `COMP-${slug}`;
  ```
- `normalizarNomeEmpresa` remove acentos, pontuação e espaços, mantendo apenas `[A-Za-z0-9]` (até 40 caracteres).
- Antes de criar novo ID, busca-se na planilha (`/api/perdecomp/verificar`) por `cnpj` ou `nome` normalizado. Se encontrado, o ID existente é reutilizado e um aviso é logado.

## Pontos de Escrita
- `appendSheetData` (`lib/googleSheets.js`): usa `values.append` com `USER_ENTERED`.
- `updateInSheets` (`lib/googleSheets.js`): usa `values.update` com intervalo dinâmico calculado por `columnNumberToLetter`.
- `app/api/infosimples/perdcomp/route.ts`: escreve na aba `PERDECOMP` atualizando ou inserindo linhas conforme necessidade.

## Cenários de Teste
1. **Cliente existente com `Cliente_ID` conhecido** – seleção via autocomplete reutiliza o ID e consulta última data.
2. **Concorrente com CNPJ válido** – `Cliente_ID` gerado `COMP-<CNPJ>` e reutilizado em chamadas futuras.
3. **Concorrente sem CNPJ** – `Cliente_ID` gerado `COMP-<NomeNormalizado>`.
4. **Reexecução para o mesmo concorrente** – rota `/perdecomp/verificar` retorna `clienteId` existente e evita duplicidade.
5. **CNPJ com apóstrofo** – função `padCNPJ14` remove caracteres não numéricos antes de comparar.

## Riscos e Mitigações
- **Duplicidade de registros**: busca prévia por CNPJ/nome antes de gerar novo ID.  
- **Variação de colunas**: escrita utiliza arrays alinhados ao cabeçalho de cada aba; valores excedentes são truncados.  
- **Campos vazios ou formatados**: normalização de CNPJ e nome garante consistência.

## Alterações Realizadas
- Novo helper `utils/clienteId.ts` para ID determinístico.  
- Rota `/api/perdecomp/verificar` agora aceita busca por `cnpj` ou `nome` e retorna `clienteId` existente.  
- Página `app/consultas/perdecomp-comparativo/page.tsx` usa regra determinística e reutiliza IDs existentes, logando avisos em inconsistências.

## Testes Executados
- `npm test` – sem testes definidos (`No tests found`).
