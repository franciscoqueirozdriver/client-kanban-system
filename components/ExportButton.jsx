'use client';
import { useState } from 'react';
import PdfModal from './PdfModal';
import * as XLSX from 'xlsx';

export default function ExportButton({ data, filters }) {
  const [open, setOpen] = useState(false);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista');
    XLSX.writeFile(wb, 'lista_prospeccao.xlsx');
  };

  const generatePdf = (max, onlyNew) => {
    // ✅ Salva dados no localStorage para evitar URL gigante
    localStorage.setItem('printData', JSON.stringify(data));
    localStorage.setItem('printFilters', JSON.stringify({ ...filters, max, onlyNew }));

    // ✅ Abre nova aba com tela de impressão sem passar JSON pela URL
    window.open(`/reports/print`, '_blank');

    // 🔥 Se for somente leads inéditos, marca na planilha
    if (onlyNew) {
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowsToMark: data.map((d) => d.rowNum).filter(Boolean) }),
      });
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 bg-blue-600 text-white rounded"
      >
        Gerar PDF
      </button>
      <button
        onClick={exportExcel}
        className="px-3 py-1 bg-green-600 text-white rounded"
      >
        Exportar Excel
      </button>
      <PdfModal
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        onGenerate={generatePdf}
      />
    </div>
  );
}

