'use client';
import { useEffect, useState } from 'react';
import Filters from '../../components/Filters';
import ReportTable from '../../components/ReportTable';
import ExportButton from '../../components/ExportButton';

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({});

  const fetchData = (filt) => {
    const params = new URLSearchParams();
    Object.entries(filt).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    fetch(`/api/reports?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.rows);
      });
  };

  const handleFilter = (f) => {
    setFilters(f);
    fetchData(f);
  };

  useEffect(() => {
    fetchData({});
  }, []);

  const criteria = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const dateStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lista de Prospecção – {dateStr}</h1>
      {criteria && <p className="text-sm text-gray-600">{criteria}</p>}
      <Filters onFilter={handleFilter} />
      <ExportButton data={rows} />
      <ReportTable rows={rows} />
    </div>
  );
}
