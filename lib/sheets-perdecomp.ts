import {
  getSheetData,
  appendSheetData,
  updateRowByIndex,
  findRowIndexById,
} from '@/lib/googleSheets.js';

export type SheetCell = string | number | boolean | null;
export type SheetRow = SheetCell[];

export const FACTS_HEADERS = [
  "Cliente_ID",
  "Empresa_ID",
  "Nome da Empresa",
  "CNPJ",
  "Perdcomp_Numero",
  "Perdcomp_Formatado",
  "B1",
  "B2",
  "Data_DDMMAA",
  "Data_ISO",
  "Tipo_Codigo",
  "Tipo_Nome",
  "Natureza",
  "Familia",
  "Credito_Codigo",
  "Credito_Descricao",
  "Risco_Nivel",
  "Protocolo",
  "Situacao",
  "Situacao_Detalhamento",
  "Motivo_Normalizado",
  "Solicitante",
  "Fonte",
  "Data_Consulta",
  "URL_Comprovante_HTML",
  "Row_Hash",
  "Inserted_At",
  "Consulta_ID",
  "Version",
  "Deleted_Flag",
];

export const SNAPSHOT_HEADERS = [
  "Cliente_ID",
  "Empresa_ID",
  "Nome da Empresa",
  "CNPJ",
  "Qtd_Total",
  "Qtd_DCOMP",
  "Qtd_REST",
  "Qtd_RESSARC",
  "Risco_Nivel",
  "Risco_Tags_JSON",
  "Por_Natureza_JSON",
  "Por_Credito_JSON",
  "Datas_JSON",
  "Primeira_Data_ISO",
  "Ultima_Data_ISO",
  "Resumo_Ultima_Consulta_JSON_P1",
  "Resumo_Ultima_Consulta_JSON_P2",
  "Card_Schema_Version",
  "Rendered_At_ISO",
  "Fonte",
  "Data_Consulta",
  "URL_Comprovante_HTML",
  "Payload_Bytes",
  "Last_Updated_ISO",
  "Snapshot_Hash",
  "Facts_Count",
  "Consulta_ID",
  "Erro_Ultima_Consulta",
];

async function ensureHeaders(sheetName: string, headers: string[]) {
  const { headers: existing } = await getSheetData(sheetName, '1:1');
  if (!existing || existing.length === 0) {
    await appendSheetData(sheetName, [headers]);
  }
}

export async function appendPerdecompFacts(rows: SheetRow[]) {
  if (!rows || rows.length === 0) return;
  await ensureHeaders('perdecomp_facts', FACTS_HEADERS);
  await appendSheetData('perdecomp_facts', rows);
}

export async function upsertPerdecompSnapshot(row: SheetRow) {
  await ensureHeaders('perdecomp_snapshot', SNAPSHOT_HEADERS);

  const clienteId = String(row[0] ?? '').trim();
  if (!clienteId) {
    throw new Error('Cliente_ID is required to upsert snapshot row');
  }

  const rowIndex = await findRowIndexById('perdecomp_snapshot', 1, 'Cliente_ID', clienteId);

  const updates: Record<string, SheetCell> = {};
  SNAPSHOT_HEADERS.forEach((header, idx) => {
    updates[header] = row[idx] ?? '';
  });

  if (rowIndex > 0) {
    await updateRowByIndex({
      sheetName: 'perdecomp_snapshot',
      rowIndex,
      updates,
    });
  } else {
    await appendSheetData('perdecomp_snapshot', [
      SNAPSHOT_HEADERS.map((header) => updates[header]),
    ]);
  }
}
