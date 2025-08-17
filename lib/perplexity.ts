// lib/perplexity.ts

// This represents the flattened structure the modal expects for suggestions
export type CompanySuggestion = {
  // Empresa
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  Pais_Empresa?: string;
  Estado_Empresa?: string;
  Cidade_Empresa?: string;
  Logradouro_Empresa?: string;
  Numero_Empresa?: string;
  Bairro_Empresa?: string;
  Complemento_Empresa?: string;
  CEP_Empresa?: string;
  CNPJ_Empresa?: string;  // somente dígitos
  DDI_Empresa?: string;   // ex: +55
  Telefones_Empresa?: string; // separados por ;
  Observacao_Empresa?: string;
  // Contato
  Nome_Contato?: string;
  Email_Contato?: string;
  Cargo_Contato?: string;
  DDI_Contato?: string;
  Telefones_Contato?: string; // separados por ;
  // Comercial
  Mercado?: string;
  Produto?: string;
  Area?: string; // Note: In the modal, this is "Área", but JSON keys shouldn't have accents.
};

function digits(s?: string) { return (s || '').replace(/\D/g, ''); }

export async function enrichCompanyData(input: { nome?: string; cnpj?: string }): Promise<Partial<CompanySuggestion>> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const nome = (input.nome || '').trim();
  const cnpj = digits(input.cnpj);

  const prompt = `
    Você é um assistente de extração de dados. Busque informações sobre a empresa brasileira com o nome "${nome}"${cnpj ? ` e CNPJ "${cnpj}"` : ''}.
    Retorne a resposta estritamente como um objeto JSON com a seguinte estrutura, sem nenhum texto ou formatação adicional.
    Preencha o máximo de campos que puder encontrar.

    \`\`\`json
    {
      "Empresa": {
        "Nome_da_Empresa": "Nome Oficial Completo",
        "Site_Empresa": "https://site.com.br",
        "Pais_Empresa": "Brasil",
        "Estado_Empresa": "SP",
        "Cidade_Empresa": "São Paulo",
        "Logradouro_Empresa": "Av. Exemplo",
        "Numero_Empresa": "123",
        "Bairro_Empresa": "Centro",
        "Complemento_Empresa": "Andar 10",
        "CEP_Empresa": "01000-000",
        "CNPJ_Empresa": "12345678000199",
        "DDI_Empresa": "+55",
        "Telefones_Empresa": "+55 11 3333-4444; +55 11 98888-7777",
        "Observacao_Empresa": "Breve resumo sobre a empresa (max 280 chars)."
      },
      "Contato": {
        "Nome_Contato": "Nome do Contato Principal",
        "Email_Contato": "contato@site.com.br",
        "Cargo_Contato": "Cargo do Contato",
        "DDI_Contato": "+55",
        "Telefones_Contato": "+55 11 99999-0000"
      },
      "Comercial": {
        "Mercado": "Mercado de Atuação",
        "Produto": "Principal Produto/Serviço",
        "Area": "Área de Atuação (ex: Saúde, Varejo)"
      }
    }
    \`\`\`
  `;

  const resp = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3-sonar-large-32k-online',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Você responde somente com um objeto JSON válido, sem nenhum texto ou explicação adicional.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Perplexity falhou: ${resp.status} ${text}`.slice(0, 200));
  }

  const json = await resp.json().catch(() => ({} as any));
  const content: string = json?.choices?.[0]?.message?.content ?? '{}';

  let parsed: any = {};
  try {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;
    parsed = JSON.parse(jsonString);
  } catch {
    parsed = {};
  }

  // Flatten the response to match the modal's expectation
  const out: Partial<CompanySuggestion> = {
    ...parsed.Empresa,
    ...parsed.Contato,
    ...parsed.Comercial,
    // Ensure CNPJ is just digits
    CNPJ_Empresa: digits(parsed.Empresa?.CNPJ_Empresa || cnpj),
    // Ensure original name is kept if not found
    Nome_da_Empresa: parsed.Empresa?.Nome_da_Empresa || nome || undefined,
  };

  // Remove any keys with undefined/null values
  Object.keys(out).forEach(key => (out[key] == null) && delete out[key]);

  return out;
}
