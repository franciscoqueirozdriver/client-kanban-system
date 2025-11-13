
export interface Company {
  cliente_id: string;
  nome_da_empresa: string;
  cnpj_empresa: string;
  [key: string]: any;
}

export interface SavedCompany {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
}
