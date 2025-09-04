/**
 * MIGRAÇÃO PER/DCOMP — cria/atualiza abas DIC_* e EVENTOS_PERDCOMP
 * Incluir novos "motivos" a partir de situacao/situacao_detalhamento
 */
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;

if (!SHEET_ID) {
  console.error("❌ SHEET_ID não definido nas variáveis de ambiente.");
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const HEADERS = {
  DIC_TIPOS: [
    "Chave",
    "Bloco",
    "Codigo",
    "Nome",
    "Descricao",
    "Fonte",
    "Exemplo",
    "Ult_Atualizacao",
  ],
  DIC_NATUREZAS: [
    "Chave",
    "Bloco",
    "Codigo",
    "Familia",
    "Nome",
    "Observacao",
    "Fonte",
    "Exemplo",
    "Ult_Atualizacao",
  ],
  DIC_CREDITOS: [
    "Chave",
    "Bloco",
    "Codigo",
    "Descricao",
    "Fonte",
    "Exemplo",
    "Ult_Atualizacao",
  ],
  EVENTOS_PERDCOMP: [
    "Perdcomp_Bruto",
    "Perdcomp_Formatado",
    "Data_ISO",
    "Tipo_Bloco4",
    "Natureza",
    "Familia",
    "Credito",
    "Tipo_Documento_RFB",
    "Tipo_Credito_RFB",
    "CNPJ",
    "Solicitante",
    "Situacao",
    "Situacao_Detalhamento",
    "Motivo_Normalizado",
    "Fonte_URL",
    "Ult_Atualizacao",
  ],
};

function colLetter(idx) {
  return String.fromCharCode(65 + idx);
}

async function ensureSheet(title) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = data.sheets?.find((s) => s.properties?.title === title);
  let sheetId = sheet?.properties?.sheetId;
  if (!sheet) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
    console.log(`✔ Criada aba: ${title}`);
  }

  const headers = HEADERS[title];
  const range = `${title}!A1:${colLetter(headers.length - 1)}1`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });

  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: { textFormat: { bold: true } },
              },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
        ],
      },
    });
  }

  console.log(`✔ Cabeçalhos ok: ${title}`);
}

async function migrate() {
  for (const title of Object.keys(HEADERS)) {
    await ensureSheet(title);
  }
  console.log("✅ Migração concluída.");
}

migrate().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});

