'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Filters from '../../components/Filters';
import ReportTable from '../../components/ReportTable';
import ExportButton from '../../components/ExportButton';
import fetchJson from '@/lib/http/fetchJson';

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({});
  const [maxLeads, setMaxLeads] = useState(30);

  const fetchData = async (filt, limit = maxLeads) => {
    const params = new URLSearchParams();
    Object.entries(filt).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    if (limit) params.append('maxLeads', limit);

    try {
      const data = await fetchJson(`/api/reports?${params.toString()}`);
      setRows(data.rows);
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        router.push('/login?callbackUrl=/reports');
      }
    }
  };

  const handleFilter = (f = {}) => {
    // ✅ Se o filtro de porte vier como array (do <select multiple>), converte para string
    const adjusted = { ...f };
    if (Array.isArray(adjusted.porte)) {
      adjusted.porte = adjusted.porte.join(',');
    }

    setFilters(adjusted);
    fetchData(adjusted);
  };

  const handleMaxLeadsChange = (value) => {
    const num = parseInt(value, 10);
    const val = Number.isNaN(num) ? 30 : num;
    setMaxLeads(val);
    fetchData(filters, val);
  };

  useEffect(() => {
    fetchData({}, maxLeads);
  }, []);

  const criteria = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const criteriaStr = [criteria, `maxLeads: ${maxLeads || 30}`]
    .filter(Boolean)
    .join(' | ');

  const dateStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lista de Prospecção – {dateStr}</h1>
      {criteriaStr && <p className="text-sm text-gray-600">{criteriaStr}</p>}

      {/* ✅ Filters envia porte como array, convertido em string aqui */}
      <Filters onFilter={handleFilter} />

      <div className="flex items-center gap-2">
        <label htmlFor="maxLeads" className="text-sm">Max Leads per Print</label>
        <input
          id="maxLeads"
          type="number"
          list="maxLeadsOptions"
          value={maxLeads}
          onChange={(e) => handleMaxLeadsChange(e.target.value)}
          className="border p-2 rounded w-24"
        />
        <datalist id="maxLeadsOptions">
          <option value="10" />
          <option value="30" />
          <option value="50" />
          <option value="100" />
        </datalist>
      </div>

      <ExportButton data={rows} />
      <ReportTable rows={rows} />
    </div>
  );
}

