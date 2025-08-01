'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import generateMessageId from '../../lib/messageId';
import KanbanColumn from '../../components/KanbanColumn';
import InteractionModal from '../../components/InteractionModal';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    const sourceCol = columns.find((c) => c.id === source.droppableId);
    const moved = sourceCol.cards[source.index];
    setDragInfo({ source, destination, draggableId, moved });
    setModalOpen(true);
  };

  const confirmMove = async ({ mensagem, observacao }) => {
    if (!dragInfo) return;
    const { source, destination, draggableId, moved } = dragInfo;
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);

    const newStatus = destCol.id;
    let newColor = moved.client.color;

    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    try {
      const interRes = await fetch('/api/interacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: draggableId,
          tipo: 'Mudança de Fase',
          deFase: source.droppableId,
          paraFase: destination.droppableId,
          mensagem,
          observacao,
          dataHora: new Date().toISOString(),
          messageId: generateMessageId(),
        }),
      });
      if (!interRes.ok) throw new Error('Erro ao salvar histórico');

      const kanbanRes = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
      });
      if (!kanbanRes.ok) throw new Error('Erro ao atualizar Kanban');

      moved.client.status = newStatus;
      moved.client.color = newColor;
      setColumns(newColumns);
    } catch (err) {
      console.error('Falha ao mover card:', err);
      fetchColumns();
    } finally {
      setModalOpen(false);
      setDragInfo(null);
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
      <InteractionModal
        open={modalOpen}
        onConfirm={confirmMove}
        onClose={() => {
          setModalOpen(false);
          setDragInfo(null);
        }}
      />
    </div>
  );
}

