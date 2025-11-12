# Diagnóstico do Problema - PER/DCOMP Card

## Problema Identificado

Quando o usuário **não marca** a opção "fazer nova consulta" (checkbox desmarcada), o sistema está buscando dados da aba **PERDECOMP** ao invés da aba **perdecomp_snapshot**, resultando em um card com informações incompletas.

## Localização do Bug

**Arquivo:** `app/api/infosimples/perdcomp/route.ts`  
**Linhas:** 226-292

### Código Atual (Incorreto)

```typescript
if (!force) {
  const { rows } = await getSheetData(PERDECOMP_SHEET_NAME); // <-- ERRADO: lê da aba 'PERDECOMP'
  
  const dataForCnpj = rows.filter(row => {
    const rowCnpj = padCNPJ14(row.CNPJ);
    return row.Cliente_ID === clienteId || rowCnpj === cnpj;
  });
  
  // Monta um card "pobre" com dados resumidos da aba PERDECOMP
  // Faltam: primeiro, site_receipt completo, perdcomp array, etc.
}
```

## Fonte Correta vs Fonte Errada

### ❌ Fonte ERRADA (atual)
- **Aba:** `PERDECOMP` (constante `PERDECOMP_SHEET_NAME`)
- **Conteúdo:** Dados resumidos/agregados
- **Campos disponíveis:** Apenas totais por família (DCOMP, REST, RESSARC, CANC)
- **Resultado:** Card pobre, sem detalhes

### ✅ Fonte CORRETA (esperada)
- **Aba:** `perdecomp_snapshot` (constante `SHEET_SNAPSHOT`)
- **Conteúdo:** Snapshot completo do último card renderizado
- **Campos disponíveis:**
  - `mappedCount` e `total_perdcomp`
  - `perdcompResumo` (totais, por família, por natureza)
  - `perdcomp` (array de registros)
  - `primeiro` (objeto com tipo_documento, tipo_credito, data_transmissao, situacao, etc.)
  - `header.requested_at`
  - `site_receipt` (link completo)
  - Risco, créditos, datas, etc.
- **Resultado:** Card rico, igual ao que viria da API

## Função Existente para Solução

Já existe a função `loadSnapshotCard` em `lib/perdecomp-persist.ts` (linha 970) que:
- Lê da aba `perdecomp_snapshot`
- Retorna o card completo em JSON
- Enriquece com dados de risco e crédito quando necessário

## Solução Proposta

Substituir a leitura da aba `PERDECOMP` pela função `loadSnapshotCard` quando `force === false`.

### Fluxo Correto

```
if (userWantsNewFetch === true) {
  // Chama API e atualiza snapshot
} else {
  // NÃO chama API
  // Lê da planilha → aba CORRETA: 'perdecomp_snapshot'
  // Usa loadSnapshotCard(clienteId)
  // Monta o card usando o shape rico do snapshot
}
```

## Impacto

- ✅ Card completo mesmo sem nova consulta
- ✅ Zero chamadas à API quando não necessário
- ✅ Informações ricas: totais, famílias, naturezas, primeiro registro, datas, link de recibo
- ✅ Empresas com mappedCount = 0 também renderizam card informativo

