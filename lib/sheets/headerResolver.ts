import { getSheetData } from "@/lib/googleSheets";

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "_")
    .replace(/__+/g, "_");
}

const ALIASES: Record<string, string> = {
  'Cliente_ID': 'cliente_id',
  'Organização - Segmento': 'segmento',
  'Organização - Tamanho da empresa': 'porte',
  'Organização - Nome': 'empresa',
  'Negócio - Título': 'oportunidade',
  'Pessoa - Cargo': 'cargo',
  'Pessoa - Email - Work': 'email_work',
  'Pessoa - Email - Home': 'email_home',
  'Pessoa - Email - Other': 'email_other',
  'Pessoa - Phone - Work': 'phone_work',
  'Pessoa - Phone - Home': 'phone_home',
  'Pessoa - Phone - Mobile': 'phone_mobile',
  'Pessoa - Phone - Other': 'phone_other',
  'Pessoa - Telefone': 'telefone',
  'Pessoa - Celular': 'celular',
  'Telefone Normalizado': 'telefone_normalizado',
  'uf': 'uf',
  'cidade_estimada': 'cidade',
  'Status_Kanban': 'status_kanban',
  'Data_Ultima_Movimentacao': 'data_ultima_movimentacao',
  'Pessoa - End. Linkedin': 'linkedin',
  'Cor_Card': 'cor_card',
  // Mapeamento do planilha_mapping.json
  'Nome da Empresa': 'empresa',
  'Site Empresa': 'site_empresa',
  'País Empresa': 'pais_empresa',
  'Estado Empresa': 'estado_empresa',
  'Cidade Empresa': 'cidade_empresa',
  'Logradouro Empresa': 'logradouro_empresa',
  'Numero Empresa': 'numero_empresa',
  'Bairro Empresa': 'bairro_empresa',
  'Complemento Empresa': 'complemento_empresa',
  'CEP Empresa': 'cep_empresa',
  'CNPJ Empresa': 'cnpj_empresa',
  'DDI Empresa': 'ddi_empresa',
  'Telefones Empresa': 'telefones_empresa',
  'Observação Empresa': 'observacao_empresa',
  'Nome Contato': 'nome_contato',
  'E-mail Contato': 'email_contato',
  'Cargo Contato': 'cargo_contato',
  'DDI Contato': 'ddi_contato',
  'Telefones Contato': 'telefones_contato',
  'Observação Contato': 'observacao_contato',
  'Tipo do Serv. Comunicação': 'tipo_serv_comunicacao',
  'ID do Serv. Comunicação': 'id_serv_comunicacao',
  'Área': 'area',
  'Etapa': 'etapa',
  'Funil': 'funil',
  'Nome do Lead': 'nome_lead',
  'Origem': 'origem',
  'Sub-Origem': 'sub_origem',
  'Mercado': 'mercado',
  'Produto': 'produto',
  'Site': 'site',
  'País': 'pais',
  'Estado': 'estado',
  'Cidade': 'cidade',
  'Logradouro': 'logradouro',
  'Número': 'numero',
  'Bairro': 'bairro',
  'Complemento': 'complemento',
  'CEP': 'cep',
  'DDI': 'ddi',
  'Telefones': 'telefones',
  'Observação': 'observacao',
  'CPF/CNPJ': 'cpf_cnpj',
};

export type ColumnResolver = (logical: string) => string;

/**
 * Cria uma função que resolve o nome da coluna para o formato snake_case
 * ou usa um alias pré-definido.
 * @param sheetName Nome da aba da planilha (usado para cache)
 * @returns Função de resolução de coluna
 */
export async function buildColumnResolver(
  sheetName: string
): Promise<ColumnResolver> {
  const { headers } = await getSheetData(sheetName, 'A1:ZZ1');
  const realHeaders = headers || [];
  const normalizedMap: Record<string, string> = {};
  for (const realHeader of realHeaders) {
    normalizedMap[normalizeHeader(realHeader)] = realHeader;
  }

  return (logical: string): string => {
    const alias = ALIASES[logical];
    const target = alias || normalizeHeader(logical);

    if (normalizedMap[target]) {
      return normalizedMap[target];
    }

    // Fallback para os aliases que já são snake_case
    if (alias && normalizedMap[alias]) {
      return normalizedMap[alias];
    }

    // Fallbacks para variações comuns
    const fallbacks: Record<string, string[]> = {
      empresa: ["organizacao_nome"],
      cnpj_empresa: ["cnpj"],
      cliente_id: ["clienteid"],
    };

    if (fallbacks[target]) {
      for (const fallback of fallbacks[target]) {
        if (normalizedMap[fallback]) {
          return normalizedMap[fallback];
        }
      }
    }

    // Se não encontrar, retorna o nome original para que o getSheetData possa tentar
    // usar o nome da coluna como chave (embora o ideal seja que o mapeamento funcione).
    // O erro de coluna faltante será tratado na API.
    return logical;
  };
}
