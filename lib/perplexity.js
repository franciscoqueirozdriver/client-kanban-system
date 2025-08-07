export async function enrichCompanyData(data) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return data;

  const prompt = `Responda em JSON com os campos: nome, site, pais, estado, cidade, logradouro, numero, bairro, complemento, cep, cnpj, ddi, telefone, telefone2, observacao. Use os dados abaixo como base e complemente com informações públicas.\n\n${JSON.stringify(data)}`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-small-online',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (text) {
      try {
        const enriched = JSON.parse(text);
        return { ...data, ...enriched };
      } catch {
        // ignore parse error
      }
    }
  } catch (err) {
    console.error('Perplexity enrichment failed', err);
  }
  return data;
}
