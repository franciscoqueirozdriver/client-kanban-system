'use client';
import { Draggable } from '@hello-pangea/dnd';

export default function KanbanCard({ card, index }) {
  const { client } = card;

  const colorStyle = {
    backgroundColor:
      client.color === 'green'
        ? '#a3ffac'  // ✅ Novo verde mais leve
        : client.color === 'red'
          ? '#ffca99' // ✅ Novo vermelho mais leve
          : 'white',
  };

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style, ...colorStyle }}
          className="p-2 mb-2 rounded shadow"
        >
          <h4 className="text-sm font-semibold mb-1">{client.company}</h4>
          {(client.city || client.uf) && (
            <p className="text-[10px] text-gray-600 mb-1">
              {[client.city, client.uf].filter(Boolean).join(' - ')}
            </p>
          )}
          {client.opportunities.length > 0 && (
            <ul className="text-[10px] list-disc ml-4 mb-1">
              {client.opportunities.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
          {client.contacts.map((c, i) => (
            <div key={i} className="text-xs border-t pt-1">
              <p className="font-medium">{c.name}</p>
              {c.role && <p className="text-[10px]">{c.role}</p>}
              {c.email && (
                <p>
                  <a
                    href={`mailto:${c.email}`}
                    className="text-blue-600 underline"
                  >
                    {c.email}
                  </a>
                </p>
              )}
              {c.normalizedPhones && c.normalizedPhones.length > 0 && (
                <p className="text-[10px]">
                  {c.normalizedPhones.join(' / ')}
                </p>
              )}
              {c.linkedin && (
                <p>
                  <a
                    href={c.linkedin}
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
