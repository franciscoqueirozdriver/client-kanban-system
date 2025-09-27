'use client';
import { useEffect, useState } from 'react';

export default function Filters({ onFilter }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ segmento: '', porte: [], uf: '', cidade: '' });
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

  const handleMultiSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setFilters((prev) => ({ ...prev, porte: selected }));
  };

  const inputClassName =
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="global-search" className="text-sm font-medium text-muted-foreground">
          Busca rápida
        </label>
        <input
          id="global-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por empresa, contato ou oportunidade"
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-segmento" className="text-sm font-medium text-muted-foreground">
            Segmento
          </label>
          <select
            id="filter-segmento"
            value={filters.segmento}
            onChange={(e) => handleChange('segmento', e.target.value)}
            className={inputClassName}
          >
            <option value="">Todos os segmentos</option>
            {options.segmento.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-porte" className="text-sm font-medium text-muted-foreground">
            Porte
          </label>
          <select
            id="filter-porte"
            multiple
            value={filters.porte}
            onChange={handleMultiSelect}
            className={`${inputClassName} min-h-[120px]`}
          >
            {options.porte.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-uf" className="text-sm font-medium text-muted-foreground">
            UF
          </label>
          <select
            id="filter-uf"
            value={filters.uf}
            onChange={(e) => handleChange('uf', e.target.value)}
            className={inputClassName}
          >
            <option value="">Todos os estados</option>
            {options.uf.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-cidade" className="text-sm font-medium text-muted-foreground">
            Cidade
          </label>
          <select
            id="filter-cidade"
            value={filters.cidade}
            onChange={(e) => handleChange('cidade', e.target.value)}
            className={inputClassName}
          >
            <option value="">Todas as cidades</option>
            {options.cidade.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

