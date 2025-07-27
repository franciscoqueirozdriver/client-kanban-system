'use client';
import { useEffect, useState } from 'react';

export default function Filters({ onFilter }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ segmento: '', porte: '', uf: '', cidade: '' });
  const [options, setOptions] = useState({ segmento: [], porte: [], uf: [], cidade: [] });

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => setOptions(data.filters));
  }, []);

  useEffect(() => {
    onFilter && onFilter({ query, ...filters });
  }, [query, filters]);

  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(options).map(([key, values]) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">{key}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
