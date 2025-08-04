'use client';
import { useEffect, useState } from 'react';

export default function Filters({ onFilter }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    segmento: '',
    porte: [],
    uf: '',
    cidade: '',
    proprietario: '',
    negocioStatus: '',
  });
  const [options, setOptions] = useState({
    segmento: [],
    porte: [],
    uf: [],
    cidade: [],
    proprietario: [],
    negocioStatus: [],
  });

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) =>
        setOptions((prev) => ({ ...prev, ...(data.filters || {}) }))
      );
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

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {/* Segmento */}
        <select
          value={filters.segmento}
          onChange={(e) => handleChange('segmento', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">segmento</option>
          {(options.segmento || []).map((v) => (
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
          {(options.porte || []).map((v) => (
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
          {(options.uf || []).map((v) => (
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
          {(options.cidade || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Negócio - Proprietário */}
        <select
          value={filters.proprietario}
          onChange={(e) => handleChange('proprietario', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">negócio - proprietário</option>
          {(options.proprietario || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Negócio - Status */}
        <select
          value={filters.negocioStatus}
          onChange={(e) => handleChange('negocioStatus', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">negócio - status</option>
          {(options.negocioStatus || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

