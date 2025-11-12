import { getCompanySheet } from '../../lib/googleSheets';
import * as XLSX from 'xlsx';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    const sheet = await getCompanySheet();
    const data = sheet.data.values || [];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'empresas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="empresas.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Erro ao exportar empresas:', err);
    res.status(500).json({ error: 'Erro ao exportar empresas' });
  }
}
