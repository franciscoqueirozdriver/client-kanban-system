'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    fetch('/api/kanban')
      .then((res) => res.json())
      .then(setColumns);
  }, []);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);
    moved.client.status = destCol.id;
      if (destCol.id === 'Perdido') {
      moved.client.color = '#fecaca';
    } else if (moved.client.color === '#fecaca') {
      moved.client.color = '';
    }
    setColumns(newColumns);

    const payload = { id: draggableId, destination };
    if (destCol.id === 'Perdido') {
      payload.color = '#fecaca';
    } else if (moved.client.color === '#fecaca') {
      payload.color = '';
    }
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  return (
    <div className="p-4 overflow-x-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {columns.map((col) => (
            <KanbanColumn key={col.id} column={col} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

