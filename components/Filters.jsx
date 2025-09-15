"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import fetchJson from '@/lib/http/fetchJson';

export default function Filters({ onFilter }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ segmento: '', porte: [], uf: '', cidade: '' });
  const [options, setOptions] = useState({ segmento: [], porte: [], uf: [], cidade: [] });

  const router = useRouter();

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await fetchJson('/api/clientes');
        setOptions(data.filters || { segmento: [], porte: [], uf: [], cidade: [] });
      } catch (e) {
        console.error(e);
        if (e?.status === 401) {
          router.replace(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
        }
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    onFilter && onFilter({ query, ...filters });
  }, [query, filters]);

  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setFilters((prev) => ({ ...prev, porte: selected }));
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar..."
        className="border p-2 rounded"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {/* Segmento */}
        <select
          value={filters.segmento}
          onChange={(e) => handleChange('segmento', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">segmento</option>
          {options.segmento.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* ✅ Porte com múltipla escolha */}
        <select
          multiple
          value={filters.porte}
          onChange={handleMultiSelect}
          className="border p-2 rounded h-24"
        >
          {options.porte.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* UF */}
        <select
          value={filters.uf}
          onChange={(e) => handleChange('uf', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">uf</option>
          {options.uf.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Cidade */}
        <select
          value={filters.cidade}
          onChange={(e) => handleChange('cidade', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">cidade</option>
          {options.cidade.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

