import { getSheetData } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { rows } = await getSheetData('Padroes');
    const produtos = Array.from(new Set(rows.map(r => r.Produtos).filter(Boolean)));
    const mercados = Array.from(new Set(rows.map(r => r.Mercados).filter(Boolean)));
    res.status(200).json({ produtos, mercados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
