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
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Gerar PDF
      </button>
      <button
        type="button"
        onClick={exportExcel}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

