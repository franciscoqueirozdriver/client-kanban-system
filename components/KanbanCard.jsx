'use client';
import { Draggable } from '@hello-pangea/dnd';

export default function KanbanCard({ card, index }) {
  const { client } = card;
  let bgClass = 'bg-white';
  if (client.status === 'Perdido' || client.color === '#fecaca') {
    bgClass = 'bg-red-200';
  } else if (client.color === '#d1fae5') {
    bgClass = 'bg-green-200';
  }


  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-2 mb-2 rounded shadow ${bgClass}`}
        >
          <h4 className="text-sm font-semibold mb-1">{client.company}</h4>
          {(client.city || client.uf) && (
            <p className="text-[10px] text-gray-600 mb-1">
              {[client.city, client.uf].filter(Boolean).join(' - ')}
            </p>
          )}
          {client.contacts.map((c, i) => (
            <div key={i} className="text-xs border-t pt-1">
              <p className="font-medium">{c.nome}</p>
              <p>{c.cargo}</p>
              {c.email && (
                <p>
                  <a href={`mailto:${c.email}`} className="text-blue-600 underline">
                    {c.email}
                  </a>
                </p>
              )}
              {c.telefone && <p>Tel: {c.telefone}</p>}
              {c.celular && <p>Cel: {c.celular}</p>}
              {c.linkedin_contato && (
                <p>
                  <a
                    href={c.linkedin_contato}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Draggable>
  );
}
