'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState, useRef } from 'react';
import KanbanColumn from '../../components/KanbanColumn';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('card');
  const toggleTimer = useRef(null);

  const sortColumns = (cols) =>
    cols.map((col) => ({
      ...col,
      cards: col.cards
        .slice()
        .sort((a, b) => {
          const da = new Date(a.client.dataEntradaColuna || '');
          const db = new Date(b.client.dataEntradaColuna || '');
          return da - db;
        }),
    }));

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();

    data.forEach((col) => {
      col.cards.forEach((card) => {
        if (!card.client.dataEntradaColuna) {
          const agora = new Date().toISOString();
          card.client.dataEntradaColuna = agora;
          fetch('/api/kanban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: card.id, dataEntradaColuna: agora }),
          });
        }
      });
    });

    const sorted = sortColumns(data);
    setAllColumns(sorted);
    setColumns(sorted);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  // Lê modo salvo em localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kanbanView');
    if (saved === 'card' || saved === 'list') {
      setView(saved);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search.toLowerCase();
      const filtered = allColumns.map((col) => ({
        ...col,
        cards: col.cards.filter((card) => {
          if (!q) return true;
          const c = card.client;
          const texto = [
            c.company,
            c.city,
            c.uf,
            ...(c.opportunities || []),
            ...(c.contacts || []).flatMap((ct) => [
              ct.name || '',
              ct.email || '',
              ct.phone || '',
              ...(ct.normalizedPhones || []),
            ]),
          ]
            .join(' ')
            .toLowerCase();
          return texto.includes(q);
        }),
      }));
      setColumns(sortColumns(filtered));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, allColumns]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);

    const newStatus = destCol.id;
    let newColor = moved.client.color;
    const agora = new Date().toISOString();

    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    moved.client.status = newStatus;
    moved.client.color = newColor;
    moved.client.dataEntradaColuna = agora;

    setColumns(sortColumns(newColumns));

    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: draggableId,
        status: newStatus,
        color: newColor,
        dataEntradaColuna: agora,
      }),
    });

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
  };

  const handleToggleView = () => {
    const novo = view === 'card' ? 'list' : 'card';
    if (toggleTimer.current) clearTimeout(toggleTimer.current);
    toggleTimer.current = setTimeout(() => {
      setView(novo);
      localStorage.setItem('kanbanView', novo);
    }, 300);
  };

  return (
    <div className="p-4 overflow-x-auto space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="border p-2 rounded flex-1"
        />
        <button
          type="button"
          onClick={handleToggleView}
          className="border p-2 rounded"
        >
          {view === 'card' ? 'Ver Lista' : 'Ver Cards'}
        </button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {columns.map((col) => (
            <KanbanColumn key={col.id} column={col} view={view} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

