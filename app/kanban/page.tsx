'use client';

import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import Filters from '@/components/Filters';
import KanbanColumn from '@/components/KanbanColumn';
import SummaryCard from '@/components/SummaryCard';
import SpotterModal from '@/components/spotter/SpotterModal';
import ViewToggle from '@/components/view-toggle/ViewToggle';
import Views from './Views';
import { useFilterState } from '@/hooks/useFilterState';

interface Client {
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
  [key: string]: any;
}

interface Card {
  id: string;
  client: Client;
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

interface FilterOptions {
  segmento: { label: string; value: string }[];
  porte: { label: string; value: string }[];
  uf: { label: string; value: string }[];
  cidade: { label: string; value: string }[];
}

function KanbanPage() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [allOptions, setAllOptions] = useState<Omit<FilterOptions, 'query'>>({ segmento: [], porte: [], uf: [], cidade: [] });
  const [isUpdating, setIsUpdating] = useState(false);
  const [spotterOpen, setSpotterOpen] = useState(false);
  const [spotterLead, setSpotterLead] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const { state: filterState, update: handleFilterUpdate, reset } = useFilterState({
    query: [],
    segmento: [],
    porte: [],
    uf: [],
    cidade: [],
  });

  const filters = useMemo(
    () => ({
      segmento: filterState.segmento,
      porte: filterState.porte,
      uf: filterState.uf,
      cidade: filterState.cidade,
    }),
    [filterState.segmento, filterState.porte, filterState.uf, filterState.cidade],
  );

  const query = useMemo(() => filterState.query?.[0] || '', [filterState.query]);

  const searchParams = useSearchParams();
  const view =
    searchParams?.get('view') ||
    (typeof window !== 'undefined' && localStorage.getItem('kanban_view_pref')) ||
    'kanban';

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  const fetchFilterOptions = async () => {
    const res = await fetch('/api/clientes');
    const data = await res.json();
    setAllOptions(data.filters);
  };

  useEffect(() => {
    fetchColumns();
    fetchFilterOptions();
  }, []);

  const filteredColumns = useMemo(() => {
    if (!filterState.query.length && !filters.segmento.length && !filters.porte.length && !filters.uf.length && !filters.cidade.length) {
      return columns;
    }

    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        const client = card.client;
        if (filters.segmento.length > 0 && !filters.segmento.includes((client.segment || '').trim())) return false;
        if (filters.porte.length > 0 && !filters.porte.includes((client.size || '').trim())) return false;
        if (filters.uf.length > 0 && !filters.uf.includes((client.uf || '').trim())) return false;
        if (filters.cidade.length > 0 && !filters.cidade.includes((client.city || '').trim())) return false;

        if (query) {
          const q = query.toLowerCase();
          const matchName = (client.company || '').toLowerCase().includes(q);
          const matchContact = (client.contacts || []).some((c: any) => (c.name || c.nome || '').toLowerCase().includes(q));
          const matchOpp = (client.opportunities || []).some((o: string) => (o || '').toLowerCase().includes(q));
          if (!matchName && !matchContact && !matchOpp) return false;
        }
        return true;
      }),
    }));
  }, [columns, filterState.query, filters, query]);

  const handleFilterChange = (key: string, value: string | string[]) => {
    if (key === 'query') {
      handleFilterUpdate('query', [value as string]);
    } else {
      handleFilterUpdate(key, value as string[]);
    }
  };

  const filterOptionsForMultiSelect = useMemo(() => {
    return {
      segmento: allOptions.segmento.map((s) => ({ label: s, value: s })),
      porte: allOptions.porte.map((p) => ({ label: p, value: p })),
      uf: allOptions.uf.map((u) => ({ label: u, value: u })),
      cidade: allOptions.cidade.map((c) => ({ label: c, value: c })),
    };
  }, [allOptions]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.droppableId === result.source.droppableId && result.destination.index === result.source.index) return;
    if (isUpdating) return;

    const { source, destination, draggableId } = result;
    const allCols = [...columns];
    const sourceCol = allCols.find((c) => c.id === source.droppableId);
    const destCol = allCols.find((c) => c.id === destination.droppableId);

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
        body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
      });
      await fetchColumns();
    } catch (err) {
      fetchColumns();
      alert('Erro ao atualizar');
    } finally {
      setIsUpdating(false);
    }
  };

  const summary = useMemo(() => {
    const allCards = (filteredColumns || columns).flatMap((col) => col.cards);
    const totalLeads = allCards.length;
    const scheduled = allCards.filter((c) => ['Agendado', 'Reunião Agendada'].includes(c.client.status)).length;
    const meetings = allCards.filter((c) => ['Reunião Realizada', 'Conversa Iniciada', 'Contato Efetuado'].includes(c.client.status)).length;
    const lost = allCards.filter((c) => c.client.status === 'Perdido').length;
    const won = allCards.filter((c) => ['Vendido', 'Negociação Concluída'].includes(c.client.status)).length;
    const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

    return { totalLeads, scheduled, meetings, conversion, lost };
  }, [columns, filteredColumns]);

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
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtros avançados</h2>
          <p className="text-sm text-muted-foreground">Refine os leads exibidos utilizando os campos abaixo.</p>
        </div>
        <div className="mt-4">
          <Filters
            filters={filters}
            searchQuery={query}
            options={filterOptionsForMultiSelect}
            onFilterChange={handleFilterChange}
            onReset={reset}
          />
        </div>
      </section>

      {view === 'kanban' ? (
        <section className="rounded-3xl border border-border bg-muted/40 p-4 shadow-soft min-w-0 overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="w-full">
              <div className="flex min-h-0 w-max select-none items-stretch gap-4 pr-6" role="list">
                {(filteredColumns || columns).map((col) => (
                  <KanbanColumn key={col.id} column={col} onOpenSpotter={() => {}} />
                ))}
              </div>
            </div>
          </DragDropContext>
        </section>
      ) : (
        <Views leads={(filteredColumns || columns).flatMap((col) => col.cards.map((card) => card.client))} />
      )}

      <SpotterModal
        open={spotterOpen}
        setOpen={setSpotterOpen}
        lead={spotterLead}
        setLead={setSpotterLead}
        sending={sending}
        setSending={setSending}
      />
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
