
export interface Company {
  // Novo padrão (snake_case)
  cliente_id?: string;
  nome_da_empresa?: string;
  cnpj_empresa?: string;
  empresa_id?: string;

  // Legado camelCase
  clienteId?: string;
  nomeEmpresa?: string;
  cnpjEmpresa?: string;
  empresaId?: string;

  // Legado PascalCase (origens antigas)
  Cliente_ID?: string;
  Nome_da_Empresa?: string;
  CNPJ_Empresa?: string;
  Empresa_ID?: string;

  // Compatibilidade genérica
  [key: string]: unknown;
}

export interface SavedCompany {
  // Preferencialmente snake_case (novo padrão)
  cliente_id?: string;
  nome_da_empresa?: string;
  cnpj_empresa?: string;

  // Compatibilidade com respostas antigas / outras rotas
  Cliente_ID?: string;
  Nome_da_Empresa?: string;
  CNPJ_Empresa?: string;
}
