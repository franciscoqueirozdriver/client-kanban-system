import { getSheetData } from '../../lib/googleSheets';
import { SHEETS } from '../../lib/sheets-mapping';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const start = Date.now();
  try {
    const [padroesData, usuariosData] = await Promise.all([
      getSheetData(SHEETS.PADROES, 'A:B'),
      getSheetData(SHEETS.USUARIOS, 'A:C'), // Assuming Email is in one of the first 3 columns
    ]);

    const produtos = Array.from(new Set(padroesData.rows.map(r => r.produtos).filter(Boolean)));
    const mercados = Array.from(new Set(padroesData.rows.map(r => r.mercados).filter(Boolean)));
    const prevendedores = Array.from(new Set(usuariosData.rows.map(r => r.email).filter(Boolean)));

    console.log('PADROES_READ', { duration: Date.now() - start, count: padroesData.rows.length });
    res.status(200).json({ produtos, mercados, prevendedores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
