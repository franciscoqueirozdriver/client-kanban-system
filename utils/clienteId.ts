export function normalizarNomeEmpresa(nome: string) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 40);
}

export function gerarClienteIdDeterministico({ cnpj, nome }: { cnpj?: string; nome?: string }) {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length === 14) return `COMP-${digits}`;
  const slug = normalizarNomeEmpresa(nome || 'EmpresaSemNome');
  return `COMP-${slug || 'EmpresaSemNome'}`;
}
