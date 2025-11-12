'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Filters, { type ActiveFilters, type FilterOptions } from '@/components/Filters';
import ReportTable from '@/components/ReportTable';
import ExportButton from '@/components/ExportButton';
import SummaryCard from '@/components/SummaryCard';
import { useFilterState } from '@/hooks/useFilterState';
import { loadMetrics } from '@/lib/load/metrics';
import BannerWarning from '@/components/BannerWarning';

const filterDefaults: ActiveFilters = {
  segmento: [],
  porte: [],
  uf: [],
  cidade: [],
  erp: [],
  fase: [],
  origem: [],
  vendedor: []
};

type ReportRow = Record<string, unknown>;

export default function ReportsClient({
  initialQuery,
  initialView
}: {
  initialQuery: string;
  initialView: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [maxLeads, setMaxLeads] = useState<number>(30);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const { state: filters, replace: replaceFilters, reset } = useFilterState<ActiveFilters>(filterDefaults);

  const [query, setQuery] = useState<string>(initialQuery);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<string>(() => (initialView === 'detail' ? 'detail' : 'summary'));
  const [hasPartialData, setHasPartialData] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setView(initialView === 'detail' ? 'detail' : 'summary');
    setHydrated(true);
  }, [initialQuery, initialView]);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const trimmed = query.trim();

    if (trimmed) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }

    const normalizedView = view === 'detail' ? 'detail' : 'summary';

    if (normalizedView !== 'summary') {
      params.set('view', normalizedView);
    } else {
      params.delete('view');
    }

    const nextParamsString = params.toString();
    const next = `${pathname}${nextParamsString ? `?${nextParamsString}` : ''}`;
    const current = `${pathname}${window.location.search}`;

    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [hydrated, pathname, query, router, view]);

  useEffect(() => {
    async function fetchData() {
      const funnels = [22783, 22784]; // Example funnels
      const fromISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Example date
      const { hasPartialData, ...data } = await loadMetrics({ funnels, fromISO });
      setHasPartialData(hasPartialData);
      if (!hasPartialData) {
        // @ts-ignore
        setRows(data.rows ?? []);
      }
    }

    fetchData();
  }, [filters, maxLeads, query]);

  const filterOptions = useMemo<FilterOptions>(() => {
    const mapToOptions = (values: string[] = []) => values.map((value) => ({ label: value, value }));
    return {
      segmento: mapToOptions(options.segmento),
      porte: mapToOptions(options.porte),
      uf: mapToOptions(options.uf),
      cidade: mapToOptions(options.cidade),
      erp: mapToOptions(options.erp),
      fase: mapToOptions(options.fase),
      origem: mapToOptions(options.origem),
      vendedor: mapToOptions(options.vendedor)
    } satisfies FilterOptions;
  }, [options]);

  const handleFilterChange = (next: ActiveFilters) => {
    replaceFilters(next);
  };

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const formatNumber = (value: number) => numberFormatter.format(value);

  const summary = useMemo(() => {
    const totalLeads = rows.length;
    const uniqueCompanies = new Set(
      rows.map((row) => (typeof row.company === 'string' ? row.company.trim() : '')).filter(Boolean)
    ).size;
    const uniqueContacts = new Set(
      rows.map((row) => (typeof row.nome === 'string' ? row.nome.trim().toLowerCase() : '')).filter(Boolean)
    ).size;
    const reachable = rows.filter((row) => {
      const phones = Array.isArray((row as { normalizedPhones?: unknown }).normalizedPhones)
        ? ((row as { normalizedPhones?: string[] }).normalizedPhones ?? [])
        : [];
      const email = typeof row.email === 'string' ? row.email : '';
      return (phones && phones.length > 0) || !!email;
    }).length;

    return { totalLeads, uniqueCompanies, uniqueContacts, reachable };
  }, [rows]);

  const filtersSummary = useMemo(() => {
    const activeFilters = Object.entries(filters)
      .filter(([, values]) => Array.isArray(values) && values.length > 0)
      .map(([key, values]) => `${key}: ${(values || []).join(', ')}`);

    const trimmed = query.trim();
    if (trimmed) {
      activeFilters.unshift(`busca: ${trimmed}`);
    }

    if (view === 'detail') {
      activeFilters.push('visualização: Detalhado');
    }

    return [activeFilters.join(' | '), `maxLeads: ${maxLeads || 30}`].filter(Boolean).join(' | ');
  }, [filters, maxLeads, query, view]);

  const generatedAt = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    []
  );

  const exportFilters = useMemo(() => {
    const entries = Object.entries(filters).reduce<Record<string, string | number>>((acc, [key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        acc[key] = values.join(',');
      }
      return acc;
    }, {});

    const trimmed = query.trim();
    if (trimmed) {
      entries.q = trimmed;
    }

    entries.maxLeads = maxLeads;
    if (view === 'detail') {
      entries.view = 'detail';
    }

    return entries;
  }, [filters, maxLeads, query, view]);

  const handleMaxLeadsChange = (value: string) => {
    const num = parseInt(value, 10);
    setMaxLeads(Number.isNaN(num) ? 30 : num);
  };

  const handleReset = () => {
    reset();
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      {hasPartialData && <BannerWarning title="Dados temporariamente indisponíveis" />}
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
