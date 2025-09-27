'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import KanbanColumn from '../../components/KanbanColumn';
import Filters from '../../components/Filters';
import ViewToggle from '@/components/view-toggle/ViewToggle';
import Views from './Views';
import SummaryCard from '@/components/SummaryCard';
import Charts from '@/components/Charts';
import AlertDialog from '@/components/AlertDialog';

// O componente principal agora é um Client Component que faz o fetch dos dados
function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [filteredColumns, setFilteredColumns] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [produto, setProduto] = useState('');
  const isAdmin = process.env.NEXT_PUBLIC_IS_ADMIN === 'true';
  const [isUpdating, setIsUpdating] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', description: '' });

  const searchParams = useSearchParams();
  const view = searchParams?.get('view') || (typeof window !== 'undefined' && localStorage.getItem('kanban_view_pref')) || 'kanban';

  // Buscar dados ao montar
  useEffect(() => {
    fetchColumns();
  }, []);

  // Sempre que columns mudar, reseta o filtro
  useEffect(() => {
    setFilteredColumns(null);
  }, [columns]);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const loadProdutos = async () => {
      const res = await fetch('/api/padroes');
      const data = await res.json();
      setProdutos(data.produtos || []);
    };
    loadProdutos();
  }, [isAdmin]);

  const handleMesclar = async () => {
    if (!produto) {
      setAlertInfo({ isOpen: true, title: 'Atenção', description: 'Selecione um produto para mesclar.' });
      return;
    }
    const res = await fetch('/api/mesclar-leads-exact-spotter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produto }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAlertInfo({
        isOpen: true,
        title: 'Erro ao Mesclar',
        description: data.error || 'Ocorreu uma falha ao tentar mesclar os leads.',
      });
      return;
    }
    setAlertInfo({
      isOpen: true,
      title: 'Mesclagem Concluída',
      description: `Criadas: ${data.criadas}, Atualizadas: ${data.atualizadas}, Ignoradas: ${
        data.ignoradas
      }, Erros: ${data.erros.join(', ') || 'Nenhum'}.`,
    });
  };

  const handleFilter = ({ query, segmento, porte, uf, cidade }) => {
    // Função de filtro
    const filterFn = (client) => {
      // segmento
      if (segmento && segmento.trim()) {
        if ((client.segment || '').trim().toLowerCase() !== segmento.trim().toLowerCase()) {
          return false;
        }
      }

      // porte
      if (porte) {
        if (Array.isArray(porte)) {
          if (porte.length > 0) {
            const options = porte.map((p) => p.trim().toLowerCase());
            if (!options.includes((client.size || '').trim().toLowerCase())) return false;
          }
        } else if (porte.trim()) {
          if ((client.size || '').trim().toLowerCase() !== porte.trim().toLowerCase()) return false;
        }
      }

      // uf
      if (uf && uf.trim()) {
        if ((client.uf || '').trim().toLowerCase() !== uf.trim().toLowerCase()) return false;
      }

      // cidade
      if (cidade && cidade.trim()) {
        if ((client.city || '').trim().toLowerCase() !== cidade.trim().toLowerCase()) return false;
      }

      // query de texto
      if (query) {
        const q = query.toLowerCase();
        const matchName = (client.company || '').toLowerCase().includes(q);
        const matchContact = (client.contacts || []).some((c) =>
          (c.name || c.nome || '').toLowerCase().includes(q)
        );
        const matchOpp = (client.opportunities || []).some((o) =>
          (o || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchContact && !matchOpp) return false;
      }
      return true;
    };

    // Aplica o filtro em todas as colunas
    const newFiltered = columns.map(col => ({
      ...col,
      cards: col.cards.filter(card => filterFn(card.client))
    }));

    setFilteredColumns(newFiltered);
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    if (
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    )
      return;
    if (isUpdating) return;
    const { source, destination, draggableId } = result;
    const prevColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);

    const newStatus = destCol.id;
    if (newStatus === moved.client.status) {
      return;
    }
    let newColor = moved.client.color;

    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    moved.client.status = newStatus;
    moved.client.color = newColor;

    setColumns(newColumns);
    setIsUpdating(true);
    try {
      const res = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
      await fetchColumns();
      await fetch('/api/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: draggableId,
          tipo: 'Mudança de Fase',
          deFase: source.droppableId,
          paraFase: destination.droppableId,
          dataHora: new Date().toISOString(),
        }),
      });
    } catch (err) {
      setColumns(prevColumns);
      setAlertInfo({
        isOpen: true,
        title: 'Erro ao Atualizar',
        description: 'Não foi possível mover o card. A alteração foi desfeita.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const columnsToShow = useMemo(() => {
    const priority = [
      'Lead Selecionado',
      'Agendado',
      'Reunião Agendada',
      'Reunião Realizada',
      'Conversa Iniciada',
      'Proposta',
      'Negociação',
      'Vendido',
      'Perdido',
    ];
    const order = new Map(priority.map((stage, index) => [stage, index]));
    const originalColumns = (filteredColumns ?? columns).filter(
      (col) => col.id !== 'Enviado para Spotter',
    );
    const sorted = [...originalColumns].sort((a, b) => {
      const aIndex = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bIndex = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
    return view === 'kanban' ? sorted : originalColumns;
  }, [columns, filteredColumns, view]);

  // Transforma os dados para a tabela/lista
  const leads = useMemo(() => {
    return (filteredColumns ?? columns)
      .flatMap(col => col.cards.map(card => ({
        id: card.id,
        empresa: card.client.company,
        contato: card.client.contacts?.[0]?.name || '',
        cidade: card.client.city,
        uf: card.client.uf,
        segmento: card.client.segment,
        etapa: card.client.status,
        owner: card.client.owner || '', // Supondo que 'owner' exista
        valor: card.client.valor || '', // Supondo que 'valor' exista
        ultimoContato: card.client.dataMov,
        fonte: card.client.fonte || '', // Supondo que 'fonte' exista
        email: card.client.contacts?.[0]?.email || '',
        linkedin: card.client.contacts?.[0]?.linkedin || '',
      })));
  }, [columns, filteredColumns]);

  const clientsForCharts = useMemo(
    () => (filteredColumns ?? columns).flatMap((col) => col.cards.map((card) => card.client)),
    [columns, filteredColumns],
  );

  const summary = useMemo(() => {
    const parseCurrency = (value) => {
      if (!value) return 0;
      const sanitized = String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      const numeric = Number.parseFloat(sanitized);
      return Number.isNaN(numeric) ? 0 : numeric;
    };

    const totalLeads = leads.length;
    const scheduled = leads.filter((lead) => ['Agendado', 'Reunião Agendada'].includes(lead.etapa)).length;
    const meetings = leads.filter((lead) => ['Reunião Realizada', 'Conversa Iniciada', 'Contato Efetuado'].includes(lead.etapa)).length;
    const won = leads.filter((lead) => ['Vendido', 'Negociação Concluída'].includes(lead.etapa)).length;
    const totalValue = leads.reduce((sum, lead) => sum + parseCurrency(lead.valor), 0);
    const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

    return {
      totalLeads,
      scheduled,
      meetings,
      conversion,
      pipelineValue: formatter.format(totalValue),
    };
  }, [leads]);

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Painel de Consultas</p>
          <h1 className="text-3xl font-semibold text-foreground">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground">
            Monitore o avanço das oportunidades, visualize métricas chave e ajuste filtros em tempo real para priorizar conversões.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ViewToggle />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Leads em carteira" value={summary.totalLeads} helper="Oportunidades acompanhadas no funil" />
        <SummaryCard title="Valor em pipeline" value={summary.pipelineValue} helper="Somatório informado pelas equipes" />
        <SummaryCard title="Reuniões concluídas" value={summary.meetings} helper="Interações realizadas recentemente" />
        <SummaryCard
          title="Taxa de conversão"
          value={`${summary.conversion}%`}
          helper="Baseado nos negócios marcados como vendidos"
          trend={{ direction: summary.conversion >= 30 ? 'up' : 'neutral', label: summary.scheduled ? `${summary.scheduled} agendados` : 'Sem agendamentos' }}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Charts clients={clientsForCharts} />
        <div className="space-y-4">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtros avançados</h2>
              <p className="text-sm text-muted-foreground">
                Refine os leads exibidos nas visões de kanban, lista e split utilizando os campos de segmento, porte e localização.
              </p>
            </div>
            <div className="mt-4">
              <Filters onFilter={handleFilter} />
            </div>
          </section>

          {isAdmin && view === 'kanban' && (
            <section className="rounded-3xl border border-dashed border-border/70 bg-card p-5 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Exact Spotter</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Mescle oportunidades do Spotter diretamente com o kanban ativo para garantir atualização contínua dos dados.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                >
                  <option value="">Selecione o produto</option>
                  {produtos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={handleMesclar}
                >
                  Mesclar Leads Spotter
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {view === 'kanban' ? (
        <section className="flex min-h-0 flex-1 rounded-3xl border border-border bg-muted/40 p-4 shadow-soft">
          <DragDropContext onDragEnd={onDragEnd}>
            <div id="kanban-viewport" className="h-full w-full overflow-x-auto scrollbar-thin">
              <div className="flex h-full w-max select-none items-stretch gap-4" role="list">
                {columnsToShow.map((col) => (
                  <KanbanColumn key={col.id} column={col} />
                ))}
              </div>
            </div>
          </DragDropContext>
        </section>
      ) : (
        <div className="flex-1 min-h-0">
          <Views leads={leads} />
        </div>
      )}
      <AlertDialog
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, title: '', description: '' })}
        title={alertInfo.title}
        description={alertInfo.description}
      />
    </div>
  );
}

// O export default agora é um wrapper com Suspense
export default function KanbanPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <KanbanPage />
    </Suspense>
  );
}
