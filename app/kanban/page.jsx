'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';
import PhaseChangeModal from '../../components/PhaseChangeModal';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [pendingMove, setPendingMove] = useState(null);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  function timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  const onDragEnd = (result) => {
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
    setPendingMove({
      id: draggableId,
      source: source.droppableId,
      dest: destination.droppableId,
      status: newStatus,
      color: newColor,
      prev: columns,
    });
  };

  const handleConfirmMove = async ({ observacao, mensagem }) => {
    if (!pendingMove) return;
    const { id, source, dest, status, color } = pendingMove;
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, color }),
    });

    await fetch('/api/historico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: id,
        tipo: 'Kanban',
        deFase: source,
        paraFase: dest,
        canal: 'Sistema',
        observacao,
        mensagem,
        dataHora: timestamp(),
      }),
    });
    setPendingMove(null);
  };

  const handleCancelMove = () => {
    if (pendingMove?.prev) setColumns(pendingMove.prev);
    setPendingMove(null);
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
      <PhaseChangeModal
        open={!!pendingMove}
        onConfirm={handleConfirmMove}
        onClose={handleCancelMove}
      />
    </div>
  );
}

