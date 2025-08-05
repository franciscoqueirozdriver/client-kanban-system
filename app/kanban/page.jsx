'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';
import ObservationModal from '../../components/ObservationModal';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [pendingMove, setPendingMove] = useState(null);
  const [obsOpen, setObsOpen] = useState(false);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    const oldColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
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
      draggableId,
      sourceId: source.droppableId,
      destId: destination.droppableId,
      newStatus,
      newColor,
      oldColumns,
    });
    setObsOpen(true);
  };

  const handleConfirmMove = async (obs) => {
    if (!pendingMove) return;
    const { draggableId, newStatus, newColor, sourceId, destId } = pendingMove;
    try {
      const resKanban = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
      });
      if (!resKanban.ok) throw new Error('Falha ao atualizar Kanban');
      const resHist = await fetch('/api/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: draggableId,
          tipo: 'Mudança de Fase',
          deFase: sourceId,
          paraFase: destId,
          observacao: obs,
          dataHora: new Date().toISOString(),
        }),
      });
      if (!resHist.ok) throw new Error('Falha ao registrar interação');
    } catch (err) {
      console.error(err);
      setColumns(pendingMove.oldColumns);
    } finally {
      setPendingMove(null);
      setObsOpen(false);
    }
  };

  const handleCloseModal = () => {
    setObsOpen(false);
    if (pendingMove) {
      setColumns(pendingMove.oldColumns);
      setPendingMove(null);
    }
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
      <ObservationModal
        open={obsOpen}
        onConfirm={handleConfirmMove}
        onClose={handleCloseModal}
      />
    </div>
  );
}

