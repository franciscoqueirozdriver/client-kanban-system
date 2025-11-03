import type { NextApiRequest, NextApiResponse } from 'next';
import { askPerplexity, extractCompanySuggestions } from '@/lib/perplexity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const start = Date.now();
    const { nome } = req.body || {};
    if (!nome) return res.status(400).json({ error: 'Informe o nome da empresa' });

    const answer = await askPerplexity(`Encontre dados sobre a empresa ${nome}`);
    const suggestions = extractCompanySuggestions(answer);
    console.log('ENRIQUECER_EMPRESA', { duration: Date.now() - start });
    return res.status(200).json({ suggestion: suggestions[0] || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao enriquecer empresa' });
  }
}
