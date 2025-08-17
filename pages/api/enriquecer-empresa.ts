import type { NextApiRequest, NextApiResponse } from 'next';
import { enrichCompanyData } from '@/lib/perplexity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { nome } = req.body || {};
    if (!nome) return res.status(400).json({ error: 'Informe o nome da empresa' });

    const suggestion = await enrichCompanyData({ nome });
    return res.status(200).json({ suggestion });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao enriquecer empresa' });
  }
}
