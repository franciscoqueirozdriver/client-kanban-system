'use client';
import { Draggable } from '@hello-pangea/dnd';

export default function KanbanCard({ card, index }) {
  const { client } = card;
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="p-2 mb-2 bg-white rounded shadow"
        >
          <h4 className="text-sm font-semibold mb-1">{client.company}</h4>
          {client.contacts.map((c, i) => (
            <div key={i} className="text-xs border-t pt-1">
              <p className="font-medium">{c.nome}</p>
              <p>{c.cargo}</p>
            </div>
          ))}
        </div>
      )}
    </Draggable>
  );
}
