'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Filters from '@/components/Filters';
import ReportTable from '@/components/ReportTable';
import ExportButton from '@/components/ExportButton';
import SummaryCard from '@/components/SummaryCard';
import { useFilterState } from '@/hooks/useFilterState';

const filterDefaults = {
  segmento: [],
  porte: [],
  uf: [],
  cidade: [],
  erp: [],
  fase: [],
  origem: [],
  vendedor: []
};

function useSearchQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams();
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const qsString = qs.toString();

  useEffect(() => {
    const initial = new URLSearchParams(qsString).get('q') ?? '';
    setQuery(initial);
    setHydrated(true);
  }, [qsString]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(qsString);
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    const paramsString = params.toString();
    const next = `${pathname}${paramsString ? `?${paramsString}` : ''}`;
    const current = `${pathname}${qsString ? `?${qsString}` : ''}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [hydrated, pathname, query, router, qsString]);

  return { query, setQuery };
}

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [maxLeads, setMaxLeads] = useState(30);
  const [options, setOptions] = useState({});
  const { state: filters, replace: replaceFilters, reset } = useFilterState(filterDefaults);
  const { query, setQuery } = useSearchQuery();

  useEffect(() => {
    async function fetchOptions() {
      const response = await fetch('/api/clientes');
      const data = await response.json();
      setOptions(data.filters || {});
    }
    fetchOptions();
  }, []);

  const filterOptions = useMemo(() => {
    const mapToOptions = (values = []) => values.map((value) => ({ label: value, value }));
    return {
      segmento: mapToOptions(options.segmento),
      porte: mapToOptions(options.porte),
      uf: mapToOptions(options.uf),
      cidade: mapToOptions(options.cidade),
      erp: mapToOptions(options.erp),
      fase: mapToOptions(options.fase),
      origem: mapToOptions(options.origem),
      vendedor: mapToOptions(options.vendedor)
    };
  }, [options]);

  const handleFilterChange = (next) => {
    replaceFilters(next);
  };

  useEffect(() => {
    async function fetchData() {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length) {
          params.set(key, values.join(','));
        }
      });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      if (maxLeads) {
        params.set('maxLeads', String(maxLeads));
      }

      const response = await fetch(`/api/reports?${params.toString()}`);
      const data = await response.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    }

    fetchData();
  }, [filters, query, maxLeads]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const formatNumber = (value) => numberFormatter.format(value);

  const summary = useMemo(() => {
    const totalLeads = rows.length;
    const uniqueCompanies = new Set(rows.map((row) => (row.company || '').trim()).filter(Boolean)).size;
    const uniqueContacts = new Set(rows.map((row) => (row.nome || '').trim().toLowerCase()).filter(Boolean)).size;
    const reachable = rows.filter((row) => (Array.isArray(row.normalizedPhones) && row.normalizedPhones.length > 0) || !!row.email).length;

    return { totalLeads, uniqueCompanies, uniqueContacts, reachable };
  }, [rows]);

  const filtersSummary = useMemo(() => {
    const activeFilters = Object.entries(filters)
      .filter(([, values]) => Array.isArray(values) && values.length)
      .map(([key, values]) => `${key}: ${(values || []).join(', ')}`);
    if (query.trim()) {
      activeFilters.unshift(`busca: ${query.trim()}`);
    }
    return [activeFilters.join(' | '), `maxLeads: ${maxLeads || 30}`].filter(Boolean).join(' | ');
  }, [filters, maxLeads, query]);

  const generatedAt = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    []
  );

  const exportFilters = useMemo(() => {
    const entries = Object.entries(filters).reduce((acc, [key, values]) => {
      if (Array.isArray(values) && values.length) {
        acc[key] = values.join(',');
      }
      return acc;
    }, {});
    if (query.trim()) {
      entries.q = query.trim();
    }
    entries.maxLeads = maxLeads;
    return entries;
  }, [filters, maxLeads, query]);

  const handleMaxLeadsChange = (value) => {
    const num = parseInt(value, 10);
    setMaxLeads(Number.isNaN(num) ? 30 : num);
  };

  const handleReset = () => {
    reset();
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Relatórios</p>
          <h1 className="text-3xl font-semibold text-foreground">Lista de Prospecção</h1>
          <p className="text-sm text-muted-foreground">
            Dados consolidados em {generatedAt}. {filtersSummary ? `Filtros: ${filtersSummary}.` : 'Todos os filtros estão limpos.'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ExportButton data={rows} filters={exportFilters} />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total de leads" value={formatNumber(summary.totalLeads)} helper="Registros retornados com os filtros atuais" />
        <SummaryCard title="Empresas únicas" value={formatNumber(summary.uniqueCompanies)} helper="Organizações distintas encontradas" />
        <SummaryCard title="Contatos únicos" value={formatNumber(summary.uniqueContacts)} helper="Profissionais diferentes com dados disponíveis" />
        <SummaryCard title="Leads alcançáveis" value={formatNumber(summary.reachable)} helper="Possuem telefone ou e-mail para contato" />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configurações e filtros</h2>
            <p className="text-sm text-muted-foreground">
              Ajuste os parâmetros de segmento, porte e limite de leads para personalizar o relatório exportado.
            </p>
          </div>
          <Filters
            filters={filters}
            searchQuery={query}
            options={filterOptions}
            onFilterChange={handleFilterChange}
            onSearchChange={setQuery}
            onReset={handleReset}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="maxLeads" className="text-sm font-medium text-muted-foreground">
              Máximo de leads por impressão
            </label>
            <input
              id="maxLeads"
              type="number"
              list="maxLeadsOptions"
              value={maxLeads}
              onChange={(event) => handleMaxLeadsChange(event.target.value)}
              className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <datalist id="maxLeadsOptions">
              <option value="10" />
              <option value="30" />
              <option value="50" />
              <option value="100" />
            </datalist>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Resultado da prospecção</h2>
            <p className="text-sm text-muted-foreground">
              Visualize os leads com os filtros aplicados e exporte quando necessário.
            </p>
          </div>
          <ReportTable rows={rows} />
        </div>
      </section>
    </div>
  );
}
