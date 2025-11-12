import { getSheet, updateRow } from '../../lib/googleSheets';
import { buildReport, mapToRows } from '../../lib/report';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).end();

     const sheet = await getSheet();
    const rows = sheet.data.values || [];
    const { map } = buildReport(rows);

    const { max = 300, ...query } = req.query || {};
    const requested = Number(max) || 300;
    if (requested > 300) {
      return res.status(400).json({ error: 'Use max <= 300 ou refine os filtros' });
    }
    const limit = requested;

    // ✅ Normalizar valores que venham como array em query params
    const normalizedQuery = {};
    Object.entries(query).forEach(([k, v]) => {
      normalizedQuery[k] = Array.isArray(v) ? v.join(',') : v;
    });

    const { rows: result } = mapToRows(map, normalizedQuery, limit);

    // ✅ Geração do PDF
    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [['Empresa', 'Segmento', 'Porte', 'Contato', 'Cargo', 'Telefones', 'Email', 'LinkedIn']],
      body: result.map((r) => [
        r.company,
        r.segment,
        r.size,
        r.nome,
        r.cargo,
        (r.normalizedPhones || []).join(' / '),
        r.email,
        r.linkedin,
      ]),
      margin: { top: 20, bottom: 20, left: 15, right: 15 },
    });

    const pdfData = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="lista.pdf"');
    res.send(Buffer.from(pdfData));
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
}

