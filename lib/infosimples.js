/**
 * Calls the Infosimples API to consult PER/DCOMP data.
 * @param {object} params - The parameters for the consultation.
 * @param {string} params.cnpj - The CNPJ to consult.
 * @param {number} [params.timeoutSeconds=300] - The timeout for the API call.
 * @returns {Promise<object>} The data from the API.
 */
export async function consultarPerdcomp(params) {
  const { cnpj, timeoutSeconds = 300 } = params;
  const token = process.env.INFOSIMPLES_TOKEN;

  if (!token) {
    throw new Error("Infosimples API token is not configured.");
  }

  const response = await fetch("https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": token,
    },
    body: JSON.stringify({
      cnpj,
      timeout: timeoutSeconds,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Infosimples API Error:", errorData);
    throw new Error(`Failed to fetch data from Infosimples API: ${response.statusText}`);
  }

  return response.json();
}
