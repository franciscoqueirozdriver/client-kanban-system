'use client';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  async function handleOpenEdit(card) {
    if (!window.confirm('Deseja realmente cadastrar essa empresa na planilha?')) {
      return;
    }
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: card.client }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Empresa cadastrada com sucesso!');
        card.client.sheetRow = data.row;
      } else {
        alert(data.error || 'Erro ao cadastrar empresa');
      }
    } catch (err) {
      alert('Erro ao cadastrar empresa');
    }
  }

  return (
    <div className="w-64">
      {/*
        Append the current number of cards to the column title.
        This updates automatically whenever the column prop changes,
        ensuring the count reflects drag-and-drop operations or refreshes.
      */}
      <h2 className="font-bold mb-2">
        {`${column.title} | ${column.cards.length}`}
      </h2>
      <Droppable droppableId={column.id}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="min-h-[100px] p-2 bg-gray-100 rounded"
          >
            {column.cards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(provided, snapshot) => (
                  <KanbanCard
                    key={card.id}
                    card={card}
                    index={index}
                    provided={provided}
                    snapshot={snapshot}
                    onDoubleClick={handleOpenEdit}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
