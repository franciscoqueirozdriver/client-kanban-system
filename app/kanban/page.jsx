'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

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

    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    moved.client.status = newStatus;
    moved.client.color = newColor;

    setColumns(newColumns);

    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
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

