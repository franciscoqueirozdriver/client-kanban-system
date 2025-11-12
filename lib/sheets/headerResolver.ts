
import { getSheetData } from "@/lib/googleSheets";

const ALIAS: Record<string, string> = {
  // Mapeamentos diretos para snake_case
  'cliente_id': 'cliente_id',
  'segmento': 'segmento',
  'organizacao_nome': 'organizacao_nome',
  'negocio_titulo': 'negocio_titulo',
  'negocio_pessoa_de_contato': 'negocio_pessoa_de_contato',
  'pessoa_cargo': 'pessoa_cargo',
  'pessoa_email_work': 'pessoa_email_work',
  'pessoa_email_home': 'pessoa_email_home',
  'pessoa_email_other': 'pessoa_email_other',
  'pessoa_phone_work': 'pessoa_phone_work',
  'pessoa_phone_home': 'pessoa_phone_home',
  'pessoa_phone_mobile': 'pessoa_phone_mobile',
  'pessoa_phone_other': 'pessoa_phone_other',
  'pessoa_telefone': 'pessoa_telefone',
  'pessoa_celular': 'pessoa_celular',
  'telefone_normalizado': 'telefone_normalizado',
  'organizacao_tamanho_da_empresa': 'organizacao_tamanho_da_empresa',
  'uf': 'uf',
  'cidade_estimada': 'cidade_estimada',
  'status_kanban': 'status_kanban',
  'data_ultima_movimentacao': 'data_ultima_movimentacao',
  'pessoa_end_linkedin': 'pessoa_end_linkedin',
  'cor_card': 'cor_card',

  // Aliases de nomes legados ou com variações para snake_case
  'cliente id': 'cliente_id',
  'clienteid': 'cliente_id',
  'cliente_id (cliente_id)': 'cliente_id',
  'cliente_id (cliente id)': 'cliente_id',
  'cliente_id (legacy: cliente_id)': 'cliente_id',
  'cliente_id (legacy: Cliente_ID)': 'cliente_id',

  'organização - segmento': 'segmento',
  'organizacao - segmento': 'segmento',
  'segmento (organização - segmento)': 'segmento',

  'organização - nome': 'organizacao_nome',
  'negócio - título': 'negocio_titulo',
  'negócio - pessoa de contato': 'negocio_pessoa_de_contato',
  'pessoa - cargo': 'pessoa_cargo',
  'pessoa - email - work': 'pessoa_email_work',
  'pessoa - email - home': 'pessoa_email_home',
  'pessoa - email - other': 'pessoa_email_other',
  'pessoa - phone - work': 'pessoa_phone_work',
  'pessoa - phone - home': 'pessoa_phone_home',
  'pessoa - phone - mobile': 'pessoa_phone_mobile',
  'pessoa - phone - other': 'pessoa_phone_other',
  'pessoa - telefone': 'pessoa_telefone',
  'pessoa - celular': 'pessoa_celular',
  'telefone normalizado': 'telefone_normalizado',
  'organização - tamanho da empresa': 'organizacao_tamanho_da_empresa',
  'status kanban': 'status_kanban',
  'data ultima movimentacao': 'data_ultima_movimentacao',
  'pessoa - end. linkedin': 'pessoa_end_linkedin',
  'cor card': 'cor_card',
};

export function normalizeHeader(s: string): string {
  const normalized = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/gi, "") // Manter hífens
    .trim()
    .replace(/\s+/g, "_");
  
  const key = normalized.replace(/__/g, '_');
  const aliasKey = s.trim().toLowerCase();

  return ALIAS[key] || ALIAS[aliasKey] || key;
}

export async function getHeaders(sheetName: string): Promise<string[]> {
  const data = await getSheetData(sheetName, 'A1:ZZ1');
  if (!data || data.length === 0) {
      console.warn(`[getHeaders] No data returned for sheet '${sheetName}'. Assuming empty sheet.`);
      return [];
  }
  return data[0] || [];
}

export type ColumnResolver = (logical: string) => string;

export async function buildColumnResolver(
  sheetName: string
): Promise<ColumnResolver> {
  const realHeaders = await getHeaders(sheetName);
  const normalizedMap: Record<string, string> = {};
  for (const realHeader of realHeaders) {
    normalizedMap[normalizeHeader(realHeader)] = realHeader;
  }

  return (logical: string): string => {
    const normalizedLogical = normalizeHeader(logical);
    if (normalizedMap[normalizedLogical]) {
      return normalizedMap[normalizedLogical];
    }

    // Não lança mais erro, o chamador será responsável por verificar
    return ''; // Retorna string vazia se não encontrar
  };
}
