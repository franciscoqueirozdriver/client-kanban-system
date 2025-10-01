'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { usePathname, useRouter } from 'next/navigation';
import KanbanColumn from '@/components/KanbanColumn';
import Filters, { type ActiveFilters, type FilterOptions } from '@/components/Filters';
import ViewToggle from '@/components/view-toggle/ViewToggle';
import Views from './Views';
import SummaryCard from '@/components/SummaryCard';
import { useFilterState } from '@/hooks/useFilterState';
import { useQueryParam } from '@/hooks/useQueryParam';

interface ClientRecord {
  id: string;
  company: string;
  segment?: string;
  size?: string;
  uf?: string;
  city?: string;
  contacts?: any[];
  opportunities?: string[];
  status: string;
  color: string;
  valor?: string;
  dataMov?: string;
  fonte?: string;
  owner?: string;
  erp?: string;
  [key: string]: unknown;
}

interface Card {
  id: string;
  client: ClientRecord;
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

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

/**
 * Hook para sincronizar a busca textual "q" com a URL
 * sem depender de useSearchParams().toString() (que tem dado falsos positivos de null).
 * Preserva os demais parâmetros já presentes na URL.
 */
function useSearchQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParam = useQueryParam('q');
  const [query, setQuery] = useState(queryParam);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setQuery(queryParam);
    setHydrated(true);
  }, [queryParam]);

  useEffect(() => {
    if (!hydrated) return;

    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    const trimmed = query.trim();

    if (trimmed) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }

    const nextParamsString = params.toString();
    const next = `${pathname}${nextParamsString ? `?${nextParamsString}` : ''}`;
    const current = `${pathname}${currentSearch ? `${currentSearch}` : ''}`;

    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [hydrated, pathname, query, router]);

  return { query, setQuery };
}

function KanbanPage() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [allOptions, setAllOptions] = useState<Record<string, string[]>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { state: filters, replace: replaceFilters, reset } = useFilterState<ActiveFilters>(filterDefaults);
  const { query, setQuery } = useSearchQuery();

  const viewParam = useQueryParam('view');
  const view =
    viewParam ||
    (typeof window !== 'undefined' && localStorage.getItem('kanban_view_pref')) ||
    'kanban';

  useEffect(() => {
    async function fetchColumns() {
      const response = await fetch('/api/kanban');
      const data = await response.json();
      setColumns(data);
    }
    async function fetchFilterOptions() {
      const response = await fetch('/api/clientes');
      const data = await response.json();
      setAllOptions(data.filters || {});
    }
    fetchColumns();
    fetchFilterOptions();
  }, []);

  const filterOptionsForMultiSelect = useMemo<FilterOptions>(() => {
    const mapToOptions = (values?: string[]) =>
      (values || []).map((value) => ({ label: value, value }));
    const phaseOptions = columns.map((column) => ({
      label: column.title,
      value: column.id
    }));
    return {
      segmento: mapToOptions(allOptions.segmento),
      porte: mapToOptions(allOptions.porte),
      uf: mapToOptions(allOptions.uf),
      cidade: mapToOptions(allOptions.cidade),
      erp: mapToOptions(allOptions.erp),
      origem: mapToOptions(allOptions.origem),
      vendedor: mapToOptions(allOptions.vendedor),
      fase: phaseOptions
    };
  }, [allOptions, columns]);

  const handleFilterChange = (next: ActiveFilters) => {
    replaceFilters(next);
  };

  const filteredColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filterCard = (card: Card, column: Column) => {
      const client = card.client;

      if (filters.segmento.length && !filters.segmento.includes((client.segment || '').trim())) return false;
      if (filters.porte.length && !filters.porte.includes((client.size || '').trim())) return false;
      if (filters.uf.length && !filters.uf.includes((client.uf || '').trim())) return false;
      if (filters.cidade.length && !filters.cidade.includes((client.city || '').trim())) return false;
      if (filters.erp.length && !filters.erp.includes(((client.erp as string) || '').trim())) return false;
      if (filters.origem.length && !filters.origem.includes(((client.fonte as string) || '').trim())) return false;
      if (filters.vendedor.length && !filters.vendedor.includes(((client.owner as string) || '').trim())) return false;

      const statusValue = (client.status || '').trim();
      if (
        filters.fase.length &&
        !filters.fase.includes(statusValue) &&
        !filters.fase.includes(column.id) &&
        !filters.fase.includes(column.title)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const baseName = (client.company || '').toLowerCase();
      const contactMatch = Array.isArray(client.contacts)
        ? client.contacts.some((contact: any) =>
            [contact?.name, contact?.nome, contact?.email]
              .filter(Boolean)
              .some((value: string) => value.toLowerCase().includes(normalizedQuery))
          )
        : false;

      const opportunityMatch = Array.isArray(client.opportunities)
        ? client.opportunities.some((opportunity) =>
            (opportunity || '').toLowerCase().includes(normalizedQuery)
          )
        : false;

      return baseName.includes(normalizedQuery) || contactMatch || opportunityMatch;
    };

    return columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => filterCard(card, column))
    }));
  }, [columns, filters, query]);

  const summary = useMemo(() => {
    const allCards = filteredColumns.flatMap((column) => column.cards);
    const totalLeads = allCards.length;
    const meetings = allCards.filter((card) =>
      ['Reunião Realizada', 'Conversa Iniciada', 'Contato Efetuado'].includes(card.client.status)
    ).length;
    const lostCards = allCards.filter((card) => card.client.status === 'Perdido');
    const lost = lostCards.length;
    const scheduled = allCards.filter((card) =>
      ['Agendado', 'Reunião Agendada'].includes(card.client.status)
    ).length;
    const won = allCards.filter((card) =>
      ['Vendido', 'Negociação Concluída'].includes(card.client.status)
    ).length;
    const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

    return { totalLeads, meetings, lost, scheduled, conversion };
  }, [filteredColumns]);

  const handleReset = () => {
    reset();
    setQuery('');
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    )
      return;
    if (isUpdating) return;

    const { source, destination, draggableId } = result;
    const allCols = [...columns];
    const sourceCol = allCols.find((column) => column.id === source.droppableId);
    const destCol = allCols.find((column) => column.id === destination.droppableId);

    if (!sourceCol || !destCol) return;

    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);

    const newStatus = destCol.id;
    if (newStatus === moved.client.status) {
      setColumns(allCols);
      return;
    }

    let newColor = moved.client.color;
    if (newStatus === 'Perdido') newColor = 'red';
    else if (newStatus === 'Lead Selecionado') newColor = 'green';

    moved.client.status = newStatus;
    moved.client.color = newColor;

    setColumns(allCols);
    setIsUpdating(true);
    try {
      await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor })
      });
      const response = await fetch('/api/kanban');
      const data = await response.json();
      setColumns(data);
    } catch (error) {
      console.error(error);
      const response = await fetch('/api/kanban');
      const data = await response.json();
      setColumns(data);
    } finally {
      setIsUpdating(false);
    }
  };

  const filterOptions = filterOptionsForMultiSelect;

  function handleOpenSpotter(arg?: string | ClientRecord) {
    if (typeof window === 'undefined') return;

    let empresa = '';
    let id = '';

    if (typeof arg === 'string') {
      id = arg;
    } else if (arg) {
      id = arg.id ?? '';
      empresa = arg.company ?? '';
    }

    if (!id && !empresa) return;

    const url = `/spotter?empresa=${encodeURIComponent(empresa)}&id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Painel de Consultas</p>
          <h1 className="text-3xl font-semibold text-foreground">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground">Monitore o avanço das oportunidades e ajuste filtros em tempo real.</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ViewToggle />
        </div>
      </header>

      <section className="flex flex-wrap gap-4">
        <SummaryCard title="Leads em carteira" value={summary.totalLeads} helper="Oportunidades no funil" />
        <SummaryCard title="Perdidos" value={summary.lost} helper="Leads marcados como perdidos" />
        <SummaryCard title="Reuniões concluídas" value={summary.meetings} helper="Interações recentes" />
        <SummaryCard title="Taxa de conversão" value={`${summary.conversion}%`} helper="Baseado em negócios vendidos" />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtros avançados</h2>
            <p className="text-sm text-muted-foreground">Refine os leads exibidos utilizando os campos abaixo.</p>
          </div>
          <Filters
            filters={filters}
            searchQuery={query}
            options={filterOptions}
            onFilterChange={handleFilterChange}
            onSearchChange={setQuery}
            onReset={handleReset}
          />
        </div>
      </section>

      {view === 'kanban' ? (
        <section className="rounded-3xl border border-border bg-muted/40 p-4 shadow-soft">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 min-h-0" role="list">
              {filteredColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  onOpenSpotter={handleOpenSpotter}
                />
              ))}
            </div>
          </DragDropContext>
        </section>
      ) : (
        <Views leads={filteredColumns.flatMap((column) => column.cards.map((card) => card.client))} />
      )}
    </div>
  );
}

export default function KanbanPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <KanbanPage />
    </Suspense>
  );
}
