// app/kanban/KanbanClientComponent.tsx
'use client';
import { useState, useMemo } from 'react';
import type { KanbanData, KanbanColumn, KanbanCard, KanbanClient } from '../../lib/types';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { usePathname, useRouter } from 'next/navigation';
import KanbanColumnComponent from '@/components/KanbanColumn';
import Filters, { type ActiveFilters, type FilterOptions } from '@/components/Filters';
import ViewToggle from '@/components/view-toggle/ViewToggle';
import SummaryCard from '@/components/SummaryCard';
import SpotterModal from '@/components/spotter/SpotterModal';
import { useFilterState } from '@/hooks/useFilterState';
import { useQueryParam } from '@/hooks/useQueryParam';
import BannerWarning from '@/components/BannerWarning';

export interface KanbanClientProps {
  initialData: Readonly<KanbanData>;
  hasPartialData?: boolean;
}

function toMutableKanban(data: Readonly<KanbanData>): KanbanData {
  return data.map((col: Readonly<KanbanColumn>) => ({
    ...col,
    cards: [...col.cards],
  }));
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

function useSearchQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParam = useQueryParam('q');
  const [query, setQuery] = useState(queryParam);
  const [hydrated, setHydrated] = useState(false);

  useState(() => {
    setQuery(queryParam);
    setHydrated(true);
  });

  useState(() => {
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
  });

  return { query, setQuery };
}

export default function KanbanClientComponent({ initialData, hasPartialData = false }: KanbanClientProps) {
  const [columns, setColumns] = useState<KanbanData>(() => toMutableKanban(initialData));
  const [allOptions, setAllOptions] = useState<Record<string, string[]>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [spotterOpen, setSpotterOpen] = useState(false);
  const [spotterLead, setSpotterLead] = useState<KanbanClient | null>(null);
  const [isSubmittingSpotter, setIsSubmittingSpotter] = useState(false);
  const { state: filters, replace: replaceFilters, reset } = useFilterState<ActiveFilters>(filterDefaults);
  const { query, setQuery } = useSearchQuery();

  const viewParam = useQueryParam('view');
  const view =
    viewParam ||
    (typeof window !== 'undefined' && localStorage.getItem('kanban_view_pref')) ||
    'kanban';

  useState(() => {
    // Extract unique options from the data for filtering
    const options = initialData.flatMap(col => col.cards.map((card: KanbanCard) => card.client)).reduce((acc: Record<string, Set<string>>, client: KanbanClient) => {
      const fields = {
        negocio_proprietario: 'negocio_proprietario',
        negocio_etapa: 'negocio_etapa',
        organizacao_segmento: 'organizacao_segmento',
        cor_card: 'cor_card',
        porte: 'organizacao_tamanho_da_empresa'
      };
      Object.entries(fields).forEach(([key, dataKey]) => {
        const value = client[dataKey];
        if (value) {
          if (!acc[key]) {
            acc[key] = new Set();
          }
          (acc[key] as Set<string>).add(value as string);
        }
      });
      return acc;
    }, {});

    // Convert sets to sorted arrays for the filter dropdowns
    const sortedOptions: Record<string, string[]> = {};
    for (const key in options) {
      sortedOptions[key] = Array.from(options[key]).sort();
    }
    setAllOptions(sortedOptions);
  });

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

    const filterCard = (card: KanbanCard, column: KanbanColumn) => {
      const client = card.client;

      // Updated to use snake_case properties from the new API response
      if (filters.segmento.length && !filters.segmento.includes((client.organizacao_segmento || '').trim())) return false;
      if (filters.porte.length && !filters.porte.includes(((client.organizacao_tamanho_da_empresa as string) || '').trim())) return false;
      if (filters.uf.length && !filters.uf.includes((client.uf || '').trim())) return false;
      if (filters.cidade.length && !filters.cidade.includes((client.city || '').trim())) return false;
      if (filters.erp.length && !filters.erp.includes(((client.erp as string) || '').trim())) return false;
      if (filters.origem.length && !filters.origem.includes(((client.fonte as string) || '').trim())) return false;
      if (filters.vendedor.length && !filters.vendedor.includes(((client.negocio_proprietario as string) || '').trim())) return false;

      const statusValue = (client.negocio_etapa || '').trim();
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
        ? client.contacts.some((contact: { name?: string; nome?: string; email?: string }) =>
            [contact?.name, contact?.nome, contact?.email]
              .filter(Boolean)
              .some((value) => value && value.toLowerCase().includes(normalizedQuery))
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

  function handleOpenSpotter(client: KanbanClient, meta?: { cardId: string; onUpdate: (update: Partial<KanbanClient>) => void }) {
    setSpotterLead(client);
    setSpotterOpen(true);
  }

  async function handleSpotterSubmit(payload: any) {
    setIsSubmittingSpotter(true);
    try {
      const response = await fetch('/api/spoter/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const enhancedError: any = new Error(data?.error || 'Falha ao enviar ao Spotter.');
        if (data?.fieldErrors) {
          enhancedError.fieldErrors = data.fieldErrors;
        }
        if (Array.isArray(data?.messages)) {
          enhancedError.messages = data.messages;
        }
        throw enhancedError;
      }

      setSpotterOpen(false);
      setSpotterLead(null);
      return data;
    } catch (error) {
      console.error('Erro ao enviar ao Spotter:', error);
      throw error; // Re-throw para que o modal possa mostrar o erro
    } finally {
      setIsSubmittingSpotter(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      {hasPartialData && <BannerWarning title="Dados temporariamente indisponíveis" />}
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
            options={filterOptionsForMultiSelect}
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
                <KanbanColumnComponent
                  key={column.id}
                  column={column}
                  onOpenSpotter={handleOpenSpotter}
                />
              ))}
            </div>
          </DragDropContext>
        </section>
      ) : null}

      <SpotterModal
        open={spotterOpen}
        onOpenChange={setSpotterOpen}
        lead={spotterLead}
        onSubmit={handleSpotterSubmit}
        isSubmitting={isSubmittingSpotter}
      />
    </div>
  );
}
