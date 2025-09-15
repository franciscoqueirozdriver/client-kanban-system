import { getSheetData } from '../../lib/googleSheets';
import { requireSession } from '@/lib/auth/requireSession';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') return res.status(405).end();
  const start = Date.now();
  try {
    const { rows } = await getSheetData('Padroes', 'A:B');
    const produtos = Array.from(new Set(rows.map(r => r.Produtos).filter(Boolean)));
    const mercados = Array.from(new Set(rows.map(r => r.Mercados).filter(Boolean)));
    console.log('PADROES_READ', { duration: Date.now() - start, count: rows.length });
    res.status(200).json({ produtos, mercados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
