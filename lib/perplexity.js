const API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Consulta a API da Perplexity e tenta enriquecer os dados da empresa.
 * Caso a API falhe ou não retorne JSON válido, devolve os dados originais.
 */
export async function enrichCompanyData(data) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const user = process.env.PERPLEXITY_API_USER || 'francisco.queirozdriver@gmail.com';

  if (!apiKey || !data?.nome) {
    return data;
  }

  try {
    const prompt =
      `Pesquise na internet informações da empresa "${data.nome}" e ` +
      'retorne um objeto JSON com as chaves: site, pais, estado, cidade, ' +
      'logradouro, numero, bairro, complemento, cep, cnpj, ddi, telefone, ' +
      'telefone2 e observacao. Use string vazia quando não encontrar.';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-User-Id': user,
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json|```/g, '').trim();
    const info = JSON.parse(cleaned);
    return { ...data, ...info };
  } catch (err) {
    console.error('Erro na API Perplexity:', err);
    return data;
  }
}

