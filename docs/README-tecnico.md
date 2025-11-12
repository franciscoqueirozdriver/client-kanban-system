# Persistência PER/DCOMP — como funciona

Esta seção descreve o fluxo de gravação e leitura dos resultados PER/DCOMP no Google Sheets. A implementação foi revisada para garantir snapshot fiel para reutilização imediata, histórico deduplicado e observabilidade mínima sem alterar fluxos já existentes.

## Abas envolvidas

- **perdecomp_snapshot** – guarda o snapshot mais recente por `Cliente_ID`. Cada linha contém o card completo serializado (shard em `Resumo_Ultima_Consulta_JSON_P1/P2`), metadados da consulta e agregações usadas na UI.
- **perdecomp_facts** – registra o histórico linha a linha. Cada fato inclui os campos crus retornados pela coleta, além de `Row_Hash`, `Consulta_ID` e `Inserted_At` para auditoria.

## Writer (`savePerdecompResults`)

1. Recebe `{ clienteId, empresaId?, cnpj?, card, facts, meta }`.
2. Resolve o `Cliente_ID` através de `resolveClienteId` garantindo o padrão `CLT-####` (detalhes abaixo).
3. Calcula agregados para o snapshot (contagens, risco, agrupamentos por natureza/crédito, datas) e serializa o card bruto.
4. Upserta a linha na aba `perdecomp_snapshot` usando `Cliente_ID` como chave:
   - Atualiza colunas existentes sem apagar campos desconhecidos.
   - Gera `Payload_Bytes`, `Snapshot_Hash`, `Facts_Count` e zera `Erro_Ultima_Consulta` em sucesso.
5. Deduplica os fatos comparando `(Perdcomp_Numero/Protocolo, Row_Hash)` antes de fazer `append` em `perdecomp_facts`.
6. Registra logs `PERSIST_START`, `SNAPSHOT_OK`, `FACTS_OK` e `PERSIST_END`. Em caso de falha, loga `PERSIST_FAIL` e atualiza `Erro_Ultima_Consulta` com o erro.

### Política de `Cliente_ID` (`resolveClienteId`)

- Nunca são gerados IDs `COMP-*`.
- Fluxo de resolução:
  1. Usa o ID fornecido se ele já estiver no padrão `CLT-####`.
  2. Caso contrário, tenta localizar um `Cliente_ID` já existente para o mesmo CNPJ na aba `perdecomp_snapshot`.
  3. Persistindo a ausência de CLT válido, gera o próximo sequencial (`CLT-XXXX`) considerando o maior número já utilizado.
- O writer aborta com `PERSIST_ABORT_INVALID_CLIENTE_ID` caso a resolução não resulte em um CLT válido, evitando dados inconsistentes.

## Deduplicação de fatos

- `Row_Hash` é um SHA-256 construído sobre os campos naturais principais: `Perdcomp_Numero` (ou `Protocolo`), `Tipo`, `Natureza`, `Credito`, `Data_ISO` e `Valor`. Se todos estiverem vazios, cai em um hash dos dados crus (sem metadados).
- A chave composta para evitar duplicatas usa `Perdcomp_Numero` (ou `Protocolo`, se existir) + `Row_Hash`.
- Apenas novos fatos são incluídos no append; duplicados incrementam o contador de `skipped` nos logs.

## Reader (`loadSnapshotCard`)

- Busca a linha por `Cliente_ID` em `perdecomp_snapshot`.
- Concatena `Resumo_Ultima_Consulta_JSON_P1` e `Resumo_Ultima_Consulta_JSON_P2` e faz `JSON.parse` para reconstruir o card idêntico ao persistido.
- Em caso de erro de parsing, loga `SNAPSHOT_PARSE_FAIL` e retorna `null` (permitindo fallback para nova coleta).

## Integração com a rota Infosimples

- Depois de montar o payload enviado ao front, a rota `/api/infosimples/perdcomp` chama `savePerdecompResults` com o card produzido, lista normalizada de fatos e metadados (`fonte`, `dataConsultaISO`, `urlComprovante`, `cardSchemaVersion`, `consultaId`).
- As funções ficam em `lib/perdecomp-persist.ts` e são reexportadas por `@/lib/perdecomp-persist`.

## Testes

- Cobertura unitária em `lib/perdecomp-persist.test.ts` valida:
  - Upsert do snapshot, deduplicação e logs.
  - Tratamento de falhas com preenchimento de `Erro_Ultima_Consulta`.
  - Reconstrução do card via `loadSnapshotCard`.

## Backfill de `Cliente_ID`

- Script `scripts/backfill-perdecomp-cliente-id.ts` percorre as abas `perdecomp_snapshot` e `perdecomp_facts` substituindo IDs `COMP-*` por CLTs válidos resolvidos via `resolveClienteId`.
- O script atualiza o snapshot linha a linha (incluindo `Last_Updated_ISO` quando disponível) e reflete as substituições no histórico.
- Logs `BACKFILL_SNAPSHOT_UPDATED`, `BACKFILL_FACTS_UPDATED` e `BACKFILL_NO_CHANGES` permitem acompanhar o progresso.

