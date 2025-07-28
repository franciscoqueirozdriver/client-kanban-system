'use client';
import { Draggable } from '@hello-pangea/dnd';

export default function KanbanCard({ card, index }) {
  const { client } = card;

  // ✅ Cor do card baseada na coluna Cor_Card e status
  let bgColor = 'white';
  if (client.color === 'red' || client.status === 'Perdido') {
    bgColor = '#ef4444'; // vermelho
  } else if (client.color === 'green') {
    bgColor = '#22c55e'; // verde
  }

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="p-2 mb-2 rounded shadow"
          style={{ backgroundColor: bgColor }}
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

