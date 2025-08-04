'use client';
import { useEffect, useState } from 'react';

export default function Filters({ onFilter, filters = {} }) {
  const [query, setQuery] = useState('');
  const [values, setValues] = useState({
    segmento: '',
    porte: [],
    uf: '',
    cidade: '',
    proprietario: '',
    status: '',
  });

  useEffect(() => {
    onFilter && onFilter({ query, ...values });
  }, [query, values, onFilter]);

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setValues((prev) => ({ ...prev, porte: selected }));
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
          value={values.segmento}
          onChange={(e) => handleChange('segmento', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          {(filters.segmento || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* ✅ Porte com múltipla escolha */}
        <select
          multiple
          value={values.porte}
          onChange={handleMultiSelect}
          className="border p-2 rounded h-24"
        >
          {(filters.porte || []).length > 0 ? (
            (filters.porte || []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))
          ) : (
            <option value="">Todos</option>
          )}
        </select>

        {/* UF */}
        <select
          value={values.uf}
          onChange={(e) => handleChange('uf', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          {(filters.uf || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Cidade */}
        <select
          value={values.cidade}
          onChange={(e) => handleChange('cidade', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          {(filters.cidade || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Negócio - Proprietário */}
        <select
          value={values.proprietario}
          onChange={(e) => handleChange('proprietario', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          {(filters.proprietario || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Negócio - Status */}
        <select
          value={values.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos</option>
          {(filters.status || []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

