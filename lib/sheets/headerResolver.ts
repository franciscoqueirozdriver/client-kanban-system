
import { getSheetData } from "@/lib/googleSheets";

const ALIAS: Record<string, string> = {
  // Mapeamentos diretos para snake_case (baseado em planilha_mapping.json)
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
  'negocio_valor': 'negocio_valor',
  'negocio_organizacao': 'negocio_organizacao',
  'negocio_data_de_fechamento_esperada': 'negocio_data_de_fechamento_esperada',
  'negocio_data_da_proxima_atividade': 'negocio_data_da_proxima_atividade',
  'negocio_proprietario': 'negocio_proprietario',
  'negocio_etapa': 'negocio_etapa',
  'negocio_fonte_do_lead': 'negocio_fonte_do_lead',
  'negocio_qualificacao_lead_closer': 'negocio_qualificacao_lead_closer',
  'negocio_qualificacao_do_lead_sdr': 'negocio_qualificacao_do_lead_sdr',
  'negocio_motivo_da_perda': 'negocio_motivo_da_perda',
  'negocio_data_de_criacao_do_negocio': 'negocio_data_de_criacao_do_negocio',
  'negocio_sdr_responsavel': 'negocio_sdr_responsavel',
  'negocio_ganho_em': 'negocio_ganho_em',
  'negocio_data_de_perda': 'negocio_data_de_perda',
  'negocio_vlr_mensalidade': 'negocio_vlr_mensalidade',
  'negocio_vlr_implantacao': 'negocio_vlr_implantacao',
  'negocio_ranking': 'negocio_ranking',
  'negocio_negocio_fechado_em': 'negocio_negocio_fechado_em',
  'negocio_closer_lead_e_o_decisor': 'negocio_closer_lead_e_o_decisor',
  'negocio_atividades_concluidas': 'negocio_atividades_concluidas',
  'negocio_atividades_para_fazer': 'negocio_atividades_para_fazer',
  'negocio_criador': 'negocio_criador',
  'negocio_data_atualizada': 'negocio_data_atualizada',
  'negocio_data_da_ultima_atividade': 'negocio_data_da_ultima_atividade',
  'negocio_etiqueta': 'negocio_etiqueta',
  'negocio_funil': 'negocio_funil',
  'negocio_moeda_de_vlr_mensalidade': 'negocio_moeda_de_vlr_mensalidade',
  'negocio_moeda_de_vlr_implantacao': 'negocio_moeda_de_vlr_implantacao',
  'negocio_canal_de_origem': 'negocio_canal_de_origem',
  'negocio_mrr': 'negocio_mrr',
  'negocio_valor_de_produtos': 'negocio_valor_de_produtos',
  'negocio_valor_ponderado': 'negocio_valor_ponderado',
  'negocio_moeda': 'negocio_moeda',
  'negocio_id': 'negocio_id',
  'negocio_id_de_origem': 'negocio_id_de_origem',
  'negocio_id_do_canal_de_origem': 'negocio_id_do_canal_de_origem',
  'negocio_nome_do_produto': 'negocio_nome_do_produto',
  'negocio_numero_de_mensagens_de_e_mail': 'negocio_numero_de_mensagens_de_e_mail',
  'negocio_origem': 'negocio_origem',
  'negocio_probabilidade': 'negocio_probabilidade',
  'negocio_acv': 'negocio_acv',
  'negocio_arr': 'negocio_arr',
  'negocio_quantidade_de_produtos': 'negocio_quantidade_de_produtos',
  'negocio_telefone_do_closer': 'negocio_telefone_do_closer',
  'negocio_tempo_de_implantacao': 'negocio_tempo_de_implantacao',
  'negocio_total_de_atividades': 'negocio_total_de_atividades',
  'negocio_utm_campaign': 'negocio_utm_campaign',
  'negocio_utm_content': 'negocio_utm_content',
  'negocio_utm_medium': 'negocio_utm_medium',
  'negocio_utm_source': 'negocio_utm_source',
  'negocio_utm_term': 'negocio_utm_term',
  'negocio_visivel_para': 'negocio_visivel_para',
  'negocio_ultima_alteracao_de_etapa': 'negocio_ultima_alteracao_de_etapa',
  'negocio_ultimo_e_mail_enviado': 'negocio_ultimo_e_mail_enviado',
  'negocio_ultimo_e_mail_recebido': 'negocio_ultimo_e_mail_recebido',
  'negocio_status': 'negocio_status',
  'ddd': 'ddd',
  'fonte_localizacao': 'fonte_localizacao',
  'impresso_lista': 'impresso_lista',
  'pessoa_nome': 'pessoa_nome',

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
