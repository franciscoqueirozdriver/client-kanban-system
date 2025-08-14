// lib/infosimples.ts

interface PerdcompParams {
  cnpj: string;
  timeoutSeconds?: number;
}

interface InfosimplesError {
  error: string;
  error_description: string;
}

// A basic type for the expected success response.
// This can be expanded based on the actual API response structure.
interface InfosimplesSuccess {
  data: any[];
  // other fields from infosimples response
}

/**
 * Calls the Infosimples API to consult PER/DCOMP data for a given CNPJ.
 *
 * @param params - The parameters for the consultation.
 * @returns The data from the API.
 * @throws An error if the API call fails or returns an error.
 */
export async function consultarPerdcomp(
  params: PerdcompParams
): Promise<InfosimplesSuccess> {
  const { cnpj, timeoutSeconds = 300 } = params;
  const token = process.env.INFOSIMPLES_TOKEN;

  if (!token) {
    throw new Error("INFOSIMPLES_TOKEN is not set in environment variables.");
  }

  const url = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

  const body = {
    token,
    cnpj: cnpj.replace(/\D/g, ''), // Ensure only digits are sent
    timeout: timeoutSeconds,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Try to parse error response from Infosimples
      const errorData: InfosimplesError = await response.json();
      throw new Error(
        `API request failed with status ${response.status}: ${errorData.error_description || 'Unknown error'}`
      );
    }

    const result: InfosimplesSuccess = await response.json();

    if (result && 'error' in result) {
       const apiError = result as unknown as InfosimplesError;
       throw new Error(`Infosimples API Error: ${apiError.error_description}`);
    }

    return result;
  } catch (error) {
    console.error("Error calling Infosimples API:", error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}
