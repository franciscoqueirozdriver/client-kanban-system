// lib/perplexity.ts

// Mantém a estrutura “achatada” que o modal espera
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
  CNPJ_Empresa?: string;      // somente dígitos
  DDI_Empresa?: string;       // ex: +55
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
  Area?: string; // JSON keys sem acento
};

// Pistas vindas das abas Sheet1 / Leads Exact Spotter
export type SheetHints = {
  Segmento?: string;        // Sheet1: "Organização - Segmento" | Leads: "Mercado"
  EstadoUF?: string;        // Sheet1: "Estado" (uf)            | Leads: "uf"
  TelefoneContato?: string; // Sheet1: "Telefone Normalizado"   | Leads: "Telefones"
  NomeContato?: string;     // Sheet1: "Negócio - Pessoa de contato" | Leads: "Nome Contato"
  EmailContato?: string;    // Sheet1: "Pessoa - Email - Work"  | Leads: "E-mail Contato"
  LinkedinContato?: string; // Sheet1: "Pessoa - End. Linkedin"
};
function digits(s?: string) {
  return (s || '').replace(/\D/g, '');
}

export async function enrichCompanyData(
  input: { nome?: string; cnpj?: string },
  hints?: SheetHints,
  opts?: { debug?: boolean }
): Promise<{ suggestion: Partial<CompanySuggestion>; debug?: {
  endpoint: string; model: string; temperature: number;
  promptPreview: string;
  rawContent?: string; parsedJson?: any; flattened?: Partial<CompanySuggestion>;
} }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada');

  const nome = (input.nome || '').trim();
  const cnpj = digits(input.cnpj);

  if (!nome && !cnpj) {
    throw new Error('O nome ou CNPJ da empresa é obrigatório para o enriquecimento.');
  }

  const hintLines = [
    hints?.Segmento        ? `- segmento: ${hints.Segmento}` : null,
    hints?.EstadoUF        ? `- estado (UF): ${hints.EstadoUF}` : null,
    hints?.TelefoneContato ? `- telefone do contato: ${hints.TelefoneContato}` : null,
    hints?.NomeContato     ? `- contato principal: ${hints.NomeContato}` : null,
    hints?.EmailContato    ? `- email do contato: ${hints.EmailContato}` : null,
    hints?.LinkedinContato ? `- linkedin do contato: ${hints.LinkedinContato}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `
Você é um assistente de extração de dados. Complete os dados da empresa brasileira
"${nome}"${cnpj ? ` (CNPJ ${cnpj})` : ''} usando fontes públicas **e** as pistas fornecidas
das abas **Sheet1** e **Leads Exact Spotter**. Quando houver divergência, **prefira as pistas**.
Se algo não for encontrado, devolva string vazia "" (nunca invente).

Pistas disponíveis (use-as como verdade quando presentes):
${hintLines || '- (nenhuma pista foi informada)'}

Campos e onde costumam estar nas planilhas:
- segmento        → Sheet1: "Organização - Segmento" | Leads: "Mercado"
- estado (UF)     → Sheet1: "Estado" (uf)            | Leads: "uf"
- telefone contato→ Sheet1: "Telefone Normalizado"   | Leads: "Telefones"
- contato principal→Sheet1: "Negócio - Pessoa de contato" | Leads: "Nome Contato"
- e-mail          → Sheet1: "Pessoa - Email - Work"  | Leads: "E-mail Contato"
- linkedin contato→ Sheet1: "Pessoa - End. Linkedin" (use apenas para validar/confirmar)

Regras de normalização:
- "CNPJ_Empresa": somente dígitos (14), da matriz 0001 se possível.
- "Estado_Empresa": UF com 2 letras (SP, RJ, MG...).
- "DDI_Empresa" e "DDI_Contato": usar "+55" se não souber.
- "Telefones_*": separar múltiplos por "; " (ponto e vírgula + espaço).
- "Observacao_Empresa": até 280 caracteres (resumo breve).
- Prefira sede no Brasil.

Responda **apenas** com um objeto JSON válido, **sem** texto adicional.

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
    "Observacao_Empresa": "Breve resumo (≤280 chars)."
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
    "Area": "Área (ex: Saúde, Varejo)"
  }
}
`;

  const promptPreview = prompt.slice(0, 1500);

  const endpoint = process.env.PERPLEXITY_ENDPOINT || 'https://api.perplexity.ai/chat/completions';
  const model    = process.env.PERPLEXITY_MODEL    || 'sonar'; // <— modelo permitido
  const temperature = 0.2;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: 'Responda somente com um objeto JSON válido, sem texto adicional.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const json = await resp.json().catch(() => ({} as any));
  const content: string = json?.choices?.[0]?.message?.content ?? '{}';

  let parsed: any = {};
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const empresa = parsed?.Empresa || {};
  const contato = parsed?.Contato || {};
  const comercial = parsed?.Comercial || {};

  const out: Partial<CompanySuggestion> = {
    ...empresa,
    ...contato,
    ...comercial,
    // Garante CNPJ somente dígitos e preserva nome se não vier
    CNPJ_Empresa: digits(empresa?.CNPJ_Empresa),
    Nome_da_Empresa: empresa?.Nome_da_Empresa || nome || undefined,
  };

  // Remove chaves vazias/null/undefined
  Object.keys(out).forEach((k) => {
    const v = (out as any)[k];
    if (v == null || String(v).trim() === '') delete (out as any)[k];
  });

  if (opts?.debug) {
    return {
      suggestion: out,
      debug: {
        endpoint,
        model,
        temperature,
        promptPreview,
        rawContent: content,
        parsedJson: parsed,
        flattened: out,
      }
    };
  }

  return { suggestion: out };
}
