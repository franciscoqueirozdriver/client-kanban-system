// pages/api/enriquecer-empresa.js
import { PERPLEXITY } from '@/lib/env';
import { normalizeText } from '@/lib/encoding';

export const config = { runtime: 'nodejs' };

function abortSignal(timeoutMs) {
  // Compatível com Node 18+ / Next 14
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const { empresa, cnpj, paisPreferencial = 'Brasil' } = payload;

    if (!empresa && !cnpj) {
      return res.status(400).json({ error: 'Informe ao menos "empresa" ou "cnpj".' });
    }

    // Prompt minimalista para teste; substitua pelo seu prompt completo conforme necessário
    const messages = [
      {
        role: 'user',
        content:
          `Preencha dados públicos da empresa priorizando a matriz no ${paisPreferencial}. ` +
          `Se disponível, use CNPJ como âncora. Campos: nome, site, pais, estado, cidade, ` +
          `logradouro, numero, bairro, complemento, cep, cnpj, ddi, telefones, observacao. ` +
          `Se telefone não existir, não preencha DDI. Para site ausente, derive domínio de e-mails ` +
          `corporativos conhecidos (ignore provedores genéricos). Empresa: ${empresa ?? ''} | CNPJ: ${cnpj ?? ''}.`,
      },
    ];

    const r = await fetch(PERPLEXITY.ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY.API_KEY}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8',
      },
      body: JSON.stringify({
        model: PERPLEXITY.MODEL,
        messages,
      }),
      signal: abortSignal(PERPLEXITY.TIMEOUT_MS),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => null);
      return res.status(502).json({ error: 'Perplexity request failed', details: text || r.statusText });
    }

    const json = await r.json();
    // Estrutura comum: json.choices[0].message.content
    const content = json?.choices?.[0]?.message?.content || '';
    // Tente interpretar como JSON primeiro; se vier texto livre, faça um parse simples
    let dados;
    try {
      dados = JSON.parse(content);
    } catch {
      // Fallback: tente extrair pares chave: valor por linhas
      dados = {};
      const lines = String(content).split('\n');
      for (const ln of lines) {
        const [k, ...rest] = ln.split(':');
        if (!k || !rest.length) continue;
        dados[k.trim().toLowerCase().replace(/\s+/g, '_')] = rest.join(':').trim();
      }
    }

    // Normalize todos os campos de texto para evitar "SÃ£o Paulo"
    const norm = {};
    for (const [k, v] of Object.entries(dados)) {
      norm[k] = typeof v === 'string' ? normalizeText(v) : v;
    }

    // Políticas específicas:
    // 1) Se telefone vazio -> não preencher DDI
    if (!norm.telefones_empresa && !norm.telefones && !norm.telefone) {
      delete norm.ddi_empresa;
      delete norm.ddi;
    }

    // 2) Campos canônicos esperados pelo seu sheet/API
    const resposta = {
      nome: norm.nome || norm.nome_da_empresa || empresa || '',
      site: norm.site || norm.site_empresa || '',
      pais: norm.pais || '',
      estado: norm.estado || norm.uf || '',
      cidade: norm.cidade || '',
      logradouro: norm.logradouro || '',
      numero: norm.numero || '',
      bairro: norm.bairro || '',
      complemento: norm.complemento || '',
      cep: norm.cep || '',
      cnpj: norm.cnpj || cnpj || '',
      ddi: norm.ddi || norm.ddi_empresa || '',
      telefones: norm.telefones || norm.telefones_empresa || norm.telefone || '',
      observacao: norm.observacao || norm.observações || norm.observacoes || '',
      raw: json, // útil para depuração; remova se não quiser retornar
    };

    // Aqui você pode integrar com sua camada Google Sheets, se desejar,
    // usando GOOGLE creds no servidor. Exemplo (comentado):
    // await salvarNoSheet(resposta);

    return res.status(200).json({ ok: true, data: resposta });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
