'use client';
import MultiSelect from './ui/multi-select';

// Define the shape of the options for the filters
interface FilterOptions {
  segmento: { label: string; value: string }[];
  porte: { label: string; value: string }[];
  uf: { label: string; value: string }[];
  cidade: { label: string; value: string }[];
}

// Define the shape of the currently active filters
interface ActiveFilters {
  query: string;
  segmento: string[];
  porte: string[];
  uf: string[];
  cidade: string[];
}

interface FiltersProps {
  filters: ActiveFilters;
  options: FilterOptions;
  onFilterChange: (key: keyof ActiveFilters, value: string | string[]) => void;
}

export default function Filters({ filters, options, onFilterChange }: FiltersProps) {
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
          value={filters.query}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por empresa, contato ou oportunidade"
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-segmento" className="text-sm font-medium text-muted-foreground">
            Segmento
          </label>
          <MultiSelect
            options={options.segmento}
            value={filters.segmento}
            onChange={(selected) => onFilterChange('segmento', selected)}
            placeholder="Todos os segmentos"
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-porte" className="text-sm font-medium text-muted-foreground">
            Porte
          </label>
          <MultiSelect
            options={options.porte}
            value={filters.porte}
            onChange={(selected) => onFilterChange('porte', selected)}
            placeholder="Todos os portes"
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-uf" className="text-sm font-medium text-muted-foreground">
            UF
          </label>
          <MultiSelect
            options={options.uf}
            value={filters.uf}
            onChange={(selected) => onFilterChange('uf', selected)}
            placeholder="Todos os estados"
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-cidade" className="text-sm font-medium text-muted-foreground">
            Cidade
          </label>
          <MultiSelect
            options={options.cidade}
            value={filters.cidade}
            onChange={(selected) => onFilterChange('cidade', selected)}
            placeholder="Todas as cidades"
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
}