import { getSheetData } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const start = Date.now();
  try {
    const [padroesData, usuariosData] = await Promise.all([
      getSheetData('Padroes', 'A:B'),
      getSheetData('Usuarios', 'A:C'), // Assuming Email is in one of the first 3 columns
    ]);

    const produtos = Array.from(new Set(padroesData.rows.map(r => r.Produtos).filter(Boolean)));
    const mercados = Array.from(new Set(padroesData.rows.map(r => r.Mercados).filter(Boolean)));
    const prevendedores = Array.from(new Set(usuariosData.rows.map(r => r.Email).filter(Boolean)));

    console.log('PADROES_READ', { duration: Date.now() - start, count: padroesData.rows.length });
    res.status(200).json({ produtos, mercados, prevendedores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
