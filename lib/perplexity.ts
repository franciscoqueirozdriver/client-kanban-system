// lib/perplexity.ts
export type CompanySuggestion = {
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
};

function digits(s?: string) { return (s || '').replace(/\D/g, ''); }

export async function enrichCompanyData(input: { nome?: string; cnpj?: string }): Promise<Partial<CompanySuggestion>> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const nome = (input.nome || '').trim();
  const cnpj = digits(input.cnpj);

  const prompt = [
    'Você é um extrator de dados de empresas. Responda em JSON.',
    'Campos: Nome_da_Empresa, Site_Empresa, Pais_Empresa, Estado_Empresa, Cidade_Empresa,',
    'Logradouro_Empresa, Numero_Empresa, Bairro_Empresa, Complemento_Empresa, CEP_Empresa,',
    'CNPJ_Empresa (somente dígitos), DDI_Empresa (ex: +55), Telefones_Empresa (separe por ";"),',
    'Observacao_Empresa (até 280 chars).',
    `Empresa: ${nome || '(desconhecida)'}${cnpj ? ` | CNPJ: ${cnpj}` : ''}`
  ].join('\n');

  // Endpoint comum da Perplexity (mantém leve e compilável)
  const resp = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Você responde somente JSON válido.' },
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
  try { parsed = JSON.parse(content); } catch { parsed = {}; }

  const out: Partial<CompanySuggestion> = {
    Nome_da_Empresa: parsed.Nome_da_Empresa || nome || undefined,
    Site_Empresa: parsed.Site_Empresa,
    Pais_Empresa: parsed.Pais_Empresa,
    Estado_Empresa: parsed.Estado_Empresa,
    Cidade_Empresa: parsed.Cidade_Empresa,
    Logradouro_Empresa: parsed.Logradouro_Empresa,
    Numero_Empresa: parsed.Numero_Empresa,
    Bairro_Empresa: parsed.Bairro_Empresa,
    Complemento_Empresa: parsed.Complemento_Empresa,
    CEP_Empresa: parsed.CEP_Empresa,
    CNPJ_Empresa: digits(parsed.CNPJ_Empresa || cnpj),
    DDI_Empresa: parsed.DDI_Empresa,
    Telefones_Empresa: parsed.Telefones_Empresa,
    Observacao_Empresa: parsed.Observacao_Empresa
  };

  return out;
}
