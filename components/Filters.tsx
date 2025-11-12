'use client';

import { useMemo } from 'react';
import MultiSelect, { type Option } from './ui/multi-select';
import { Button } from '@/components/ui/button';

export type FilterKey =
  | 'segmento'
  | 'porte'
  | 'uf'
  | 'cidade'
  | 'erp'
  | 'fase'
  | 'origem'
  | 'vendedor';

export type ActiveFilters = Record<FilterKey, string[]>;

export type FilterOptions = Partial<Record<FilterKey, Option[]>>;

interface FiltersProps {
  filters: ActiveFilters;
  searchQuery: string;
  options: FilterOptions;
  onFilterChange: (next: ActiveFilters) => void;
  onSearchChange?: (query: string) => void;
  onReset?: () => void;
}

export default function Filters({
  filters,
  searchQuery,
  options,
  onFilterChange,
  onSearchChange,
  onReset
}: FiltersProps) {
  const searchPlaceholder = 'Buscar por empresa, contato ou oportunidade';

  const filterEntries = useMemo(() => {
    const config: { key: FilterKey; label: string; placeholder: string }[] = [
      { key: 'segmento', label: 'Segmento', placeholder: 'Todos os segmentos' },
      { key: 'porte', label: 'Porte', placeholder: 'Todos os portes' },
      { key: 'uf', label: 'UF', placeholder: 'Todos os estados' },
      { key: 'cidade', label: 'Cidade', placeholder: 'Todas as cidades' },
      { key: 'erp', label: 'ERP', placeholder: 'Todos os ERPs' },
      { key: 'fase', label: 'Fase do funil', placeholder: 'Todas as fases' },
      { key: 'origem', label: 'Origem do lead', placeholder: 'Todas as origens' },
      { key: 'vendedor', label: 'Responsável', placeholder: 'Todos os responsáveis' },
    ];
    return config.filter((entry) => options[entry.key]?.length);
  }, [options]);

  function handleSelect(key: FilterKey, values: string[]) {
    onFilterChange({ ...filters, [key]: values });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="filters-search" className="text-sm font-medium text-muted-foreground">
          Busca rápida
        </label>
        <input
          id="filters-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {filterEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filterEntries.map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">{label}</label>
              <MultiSelect
                options={options[key] ?? []}
                value={filters[key] ?? []}
                onChange={(values) => handleSelect(key, values)}
                placeholder={placeholder}
                className="h-10"
              />
            </div>
          ))}
        </div>
      ) : null}

      {onReset ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onReset} className="text-sm font-medium">
            Limpar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}
