'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import KanbanColumn from '../../components/KanbanColumn';
import Filters from '../../components/Filters';
import ViewToggle from '@/components/view-toggle/ViewToggle';
import Views from './Views';

// O componente principal agora é um Client Component que faz o fetch dos dados
function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [filteredColumns, setFilteredColumns] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [produto, setProduto] = useState('');
  const isAdmin = process.env.NEXT_PUBLIC_IS_ADMIN === 'true';
  const [isUpdating, setIsUpdating] = useState(false);

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
      alert('Selecione um produto');
      return;
    }
    const res = await fetch('/api/mesclar-leads-exact-spotter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produto }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao mesclar');
      return;
    }
    alert(
      `Criadas: ${data.criadas}\nAtualizadas: ${data.atualizadas}\nIgnoradas: ${data.ignoradas}\nErros: ${data.erros.join(', ')}`
    );
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
      alert('Erro ao atualizar');
    } finally {
      setIsUpdating(false);
    }
  };

  const columnsToShow = filteredColumns ?? columns;

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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex items-center gap-4">
          <Filters onFilter={handleFilter} />
          <ViewToggle />
        </div>
      </div>

      {isAdmin && view === 'kanban' && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className="border p-1"
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
          >
            <option value="">Produto</option>
            {produtos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={handleMesclar}
          >
            Mesclar Leads Exact Spotter
          </button>
        </div>
      )}

      {view === 'kanban' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            id="kanban-viewport"
            className="sticky top-[140px] h-[calc(100vh-220px)] w-full min-h-0 overflow-x-auto px-4 pb-3 pt-1 z-10"
          >
            <div
              className="flex items-stretch gap-3 w-max pr-4 select-none min-h-0"
              role="list"
            >
              {columnsToShow.map((col) => (
                <KanbanColumn key={col.id} column={col} />
              ))}
            </div>
          </div>
        </DragDropContext>
      ) : (
        <Views leads={leads} />
      )}
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
