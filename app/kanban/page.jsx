'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState, useCallback } from 'react';
import KanbanColumn from '../../components/KanbanColumn';
import Filters from '../../components/Filters';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchColumns = useCallback(async (filters = {}) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    });

    const res = await fetch(`/api/kanban?${params.toString()}`);
    const data = await res.json();
    setColumns(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const handleFilter = (filters) => {
    fetchColumns(filters);
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    // Optimistic update
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);
    setColumns(newColumns);

    const newStatus = destCol.id;
    let newColor = moved.client.color;
    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    // Update backend
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: draggableId,
        status: newStatus,
        color: newColor,
        source: source.droppableId,
        destination: destination.droppableId,
      }),
    });

    // Optional: refetch data after drag to ensure consistency, though optimistic update should be fine.
    // fetchColumns();
  };

  return (
    <div className="p-4 overflow-x-auto">
      <div className="mb-4">
        <Filters onFilter={handleFilter} />
      </div>
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4">
            {columns.map((col) => (
              <KanbanColumn key={col.id} column={col} />
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
