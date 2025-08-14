// lib/perplexity.js
// Exporta a função `enrichCompanyData` de forma NOMEADA e DEFAULT.
// Evita auto-imports/ciclos e lança erro claro se a env não existir.

function assertEnv() {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY ausente no .env.local");
  }
}

/**
 * Enriquecimento de cadastro de empresa via Perplexity (stub funcional).
 * Substitua pelo request real quando desejado, mantendo a assinatura.
 *
 * @param {Object} params
 * @param {string} [params.cnpj]
 * @param {string} [params.nome]
 * @param {Object} [params.existing] Campos já existentes no cadastro
 * @returns {Promise<Object>} Objeto com campos enriquecidos
 */
async function enrichCompanyData(params = {}) {
  assertEnv();

  const { cnpj = "", nome = "", existing = {} } = params;

  // === INTEGRAÇÃO REAL COM A API DA PERPLEXITY PODE SER IMPLEMENTADA AQUI ===
  // Retorno mínimo para não quebrar o fluxo atual:
  return {
    fonte: "perplexity",
    sucesso: true,
    cnpj,
    nome,
    campos: {
      ...existing,
      "Site Empresa": existing["Site Empresa"] || "",
      "País Empresa": existing["País Empresa"] || "",
      "Estado Empresa": existing["Estado Empresa"] || "",
      "Cidade Empresa": existing["Cidade Empresa"] || "",
      "Logradouro Empresa": existing["Logradouro Empresa"] || "",
      "Numero Empresa": existing["Numero Empresa"] || "",
      "Bairro Empresa": existing["Bairro Empresa"] || "",
      "Complemento Empresa": existing["Complemento Empresa"] || "",
      "CEP Empresa": existing["CEP Empresa"] || "",
      "CNPJ Empresa": existing["CNPJ Empresa"] || cnpj,
      "DDI Empresa": existing["DDI Empresa"] || "",
      "Telefones Empresa": existing["Telefones Empresa"] || "",
      "Observação Empresa": existing["Observação Empresa"] || "",
    },
  };
}

export { enrichCompanyData };
export default enrichCompanyData;

