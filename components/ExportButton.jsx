'use client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ExportButton({ data }) {
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista');
    XLSX.writeFile(wb, 'lista_prospeccao.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Empresa', 'Segmento', 'Porte', 'Contato', 'Cargo', 'Telefones', 'Email', 'LinkedIn']],
      body: data.map((r) => [
        r.company,
        r.segment,
        r.size,
        r.nome,
        r.cargo,
        [r.telefone, r.celular].filter(Boolean).join(' / '),
        r.email,
        r.linkedin,
      ]),
    });
    doc.save('lista_prospeccao.pdf');
  };

  return (
    <div className="flex gap-2">
      <button onClick={exportPDF} className="px-3 py-1 bg-blue-600 text-white rounded">
        Exportar PDF
      </button>
      <button onClick={exportExcel} className="px-3 py-1 bg-green-600 text-white rounded">
        Exportar Excel
      </button>
    </div>
  );
}
