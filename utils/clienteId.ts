import { padCNPJ14, isValidCNPJ } from './cnpj';

/**
 * Normalizes a company name into a URL-friendly slug.
 * Removes accents, special characters, and spaces, and limits the length.
 * e.g., "Salobo Metais S.A." -> "SaloboMetaisSA"
 * @param name The company name.
 * @returns A normalized string slug.
 */
export function normalizarNomeEmpresa(nome: string): string {
  if (!nome) {
    return 'EmpresaSemNome';
  }
  const slug = nome
    .normalize('NFD') // Decompose accents (e.g., 'á' -> 'a' + '´')
    .replace(/[\u0300-\u036f]/g, '') // Remove accent characters
    .replace(/[^A-Za-z0-9]/g, '') // Remove non-alphanumeric characters
    .slice(0, 40); // Limit length to 40 chars
  return slug || 'EmpresaSemNome';
}

interface EmpresaInfo {
  cnpj?: string | null;
  nome: string;
}

/**
 * Generates a deterministic Cliente_ID for a competitor.
 * Prefers CNPJ if available and valid, otherwise uses a normalized name.
 * @param empresa An object with cnpj and nome properties.
 * @returns A deterministic ID string, e.g., "COMP-08902291000115" or "COMP-SaloboMetaisSA".
 */
export function gerarClienteIdDeterministico(empresa: EmpresaInfo): string {
  const { cnpj, nome } = empresa;
  const cleanedCnpj = padCNPJ14(cnpj || '');

  if (isValidCNPJ(cleanedCnpj)) {
    return `COMP-${cleanedCnpj}`;
  }

  const nomeNormalizado = normalizarNomeEmpresa(nome);
  return `COMP-${nomeNormalizado}`;
}
