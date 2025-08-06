'use client';
import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';
import ObservationModal from '../../components/ObservationModal';
import MessageModal from '../../components/MessageModal';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [obsOpen, setObsOpen] = useState(false);
  const [pendingLog, setPendingLog] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState([]);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/mensagens?app=kanban');
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.mensagens)) return data.mensagens;
      if (Array.isArray(data?.messages)) return data.messages;
      return [];
    } catch {
      return [];
    }
  };

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

    const pending = {
      clienteId: draggableId,
      deFase: source.droppableId,
      paraFase: destination.droppableId,
    };

    const messages = await fetchMessages();
    if (messages.length > 0) {
      setModalMessages(messages);
      setPendingLog(pending);
      setMsgOpen(true);
    } else {
      setPendingLog(pending);
      setObsOpen(true);
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
      <MessageModal
        open={msgOpen}
        messages={modalMessages}
        onSelect={(msg) => {
          setPendingLog((prev) => ({ ...prev, mensagemUsada: msg.titulo }));
          setMsgOpen(false);
          setObsOpen(true);
        }}
        onClose={() => setMsgOpen(false)}
      />
      <ObservationModal
        open={obsOpen}
        onConfirm={async (obs) => {
          if (pendingLog) {
            await fetch('/api/interacoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...pendingLog,
                tipo: 'Mudança de Fase',
                observacao: obs,
                dataHora: new Date().toISOString(),
              }),
            });
          }
        }}
        onClose={() => {
          setObsOpen(false);
          setPendingLog(null);
        }}
      />
    </div>
  );
}

