import { sheets_v4 } from 'googleapis';
import { getHeaderRange, getSheetId, getSpreadsheetId } from './sheets';

/*
 * Observações de negócio (futuro):
 * - No card (UI), o total exibido deve considerar todos os eventos exceto cancelamentos.
 * - As linhas do card devem ser agregadas por família (DCOMP, REST, RESSARC) e somar
 *   naturezas com o mesmo nome, sem exibir os códigos numéricos.
 * - Caso naturezas distintas tenham nomes diferentes dentro da mesma família, devem
 *   aparecer em linhas separadas.
 * - Cancelamentos ficam restritos ao modal e não entram no total nem nas quebras.
 * - Ao persistir eventos PERDCOMP futuramente, usar normalizaMotivo para preencher
 *   a coluna Motivo_Normalizado e realizar upserts de naturezas/créditos antes do
 *   salvamento para registrar inéditos.
 */

export const PERDCOMP_HEADERS = [
  'Perdcomp_Bruto',
  'Perdcomp_Formatado',
  'Data_Transmissao',
  'Data_ISO',
  'Tipo_Bloco4',
  'Tipo_Documento_RFB',
  'Natureza',
  'Familia',
  'Credito',
  'Credito_Descricao',
  'CNPJ',
  'Solicitante',
  'Situacao',
  'Situacao_Detalhamento',
  'Motivo_Normalizado',
  'Site_Receipt_URL',
  'Ultima_Atualizacao'
] as const;

export const DIC_TIPOS_HEADERS = [
  'Chave',
  'Bloco',
  'Codigo',
  'Nome',
  'Descricao',
  'Fonte',
  'Exemplo_PERDCOMP',
  'Ult_Atualizacao'
] as const;

export const DIC_NATUREZAS_HEADERS = [
  'Chave',
  'Bloco',
  'Codigo',
  'Familia',
  'Nome',
  'Observacao',
  'Fonte',
  'Exemplo_PERDCOMP',
  'Ult_Atualizacao'
] as const;

export const DIC_CREDITOS_HEADERS = [
  'Chave',
  'Bloco',
  'Codigo',
  'Descricao',
  'Fonte',
  'Exemplo_PERDCOMP',
  'Ult_Atualizacao'
] as const;

type HeaderArray = readonly string[];

type HeaderRecord = Record<string, HeaderArray>;

export const HEADERS_BY_SHEET: HeaderRecord = {
  PERDCOMP: PERDCOMP_HEADERS,
  DIC_TIPOS: DIC_TIPOS_HEADERS,
  DIC_NATUREZAS: DIC_NATUREZAS_HEADERS,
  DIC_CREDITOS: DIC_CREDITOS_HEADERS
};

export async function ensureHeaders(
  sheets: sheets_v4.Sheets,
  title: keyof typeof HEADERS_BY_SHEET,
  headers: HeaderArray
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const headerRange = `${title}!${getHeaderRange(headers)}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerRange,
    valueInputOption: 'RAW',
    requestBody: {
      values: [Array.from(headers)]
    }
  });

  const sheetId = await getSheetId(title);
  if (sheetId === undefined) {
    throw new Error(`Sheet ID not found for title ${title}`);
  }

  const requests: sheets_v4.Schema$Request[] = [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: headers.length
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true
            }
          }
        },
        fields: 'userEnteredFormat.textFormat.bold'
      }
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    }
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests
    }
  });
}
