'use client';

import MultiSelect, { MultiSelectOption } from './ui/multi-select';

interface FilterOptions {
  segmento: MultiSelectOption[];
  porte: MultiSelectOption[];
  uf: MultiSelectOption[];
  cidade: MultiSelectOption[];
}

interface ActiveFilters {
  segmento: string[];
  porte: string[];
  uf: string[];
  cidade: string[];
}

interface FiltersProps {
  filters: ActiveFilters;
  searchQuery: string;
  options: FilterOptions;
  onFilterChange: (key: keyof ActiveFilters | 'query', value: string | string[]) => void;
  onReset?: () => void;
}

export default function Filters({ filters, searchQuery, options, onFilterChange, onReset }: FiltersProps) {
  const inputClassName =
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-soft';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor="filter-query" className="text-sm font-medium text-muted-foreground">
            Busca rápida
          </label>
          <input
            id="filter-query"
            type="text"
            value={searchQuery}
            onChange={(event) => onFilterChange('query', event.target.value)}
            placeholder="Buscar por empresa, contato ou oportunidade"
            className={inputClassName}
            autoComplete="off"
          />
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-2">
          <label id="filter-segmento-label" htmlFor="filter-segmento" className="text-sm font-medium text-muted-foreground">
            Segmento
          </label>
          <MultiSelect
            id="filter-segmento"
            labelledBy="filter-segmento-label"
            options={options.segmento}
            value={filters.segmento}
            onChange={(selected) => onFilterChange('segmento', selected)}
            placeholder="Todos os segmentos"
            className="h-11"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label id="filter-porte-label" htmlFor="filter-porte" className="text-sm font-medium text-muted-foreground">
            Porte
          </label>
          <MultiSelect
            id="filter-porte"
            labelledBy="filter-porte-label"
            options={options.porte}
            value={filters.porte}
            onChange={(selected) => onFilterChange('porte', selected)}
            placeholder="Todos os portes"
            className="h-11"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label id="filter-uf-label" htmlFor="filter-uf" className="text-sm font-medium text-muted-foreground">
            UF
          </label>
          <MultiSelect
            id="filter-uf"
            labelledBy="filter-uf-label"
            options={options.uf}
            value={filters.uf}
            onChange={(selected) => onFilterChange('uf', selected)}
            placeholder="Todos os estados"
            className="h-11"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label id="filter-cidade-label" htmlFor="filter-cidade" className="text-sm font-medium text-muted-foreground">
            Cidade
          </label>
          <MultiSelect
            id="filter-cidade"
            labelledBy="filter-cidade-label"
            options={options.cidade}
            value={filters.cidade}
            onChange={(selected) => onFilterChange('cidade', selected)}
            placeholder="Todas as cidades"
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}
