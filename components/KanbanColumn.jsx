'use client';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';
export default function KanbanColumn({ column, view = 'card' }) {
  return (
    <div className="w-64">
      <h2 className="font-bold mb-2">{`${column.title} | ${column.cards.length}`}</h2>
      {view === 'card' ? (
        <Droppable droppableId={column.id}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="min-h-[100px] p-2 bg-gray-100 rounded"
            >
              {column.cards.map((card, index) => (
                <KanbanCard key={card.id} card={card} index={index} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ) : (
        <Droppable droppableId={column.id}>
          {(provided) => (
            <table
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="min-w-full text-xs bg-white border"
            >
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2">Empresa</th>
                  <th className="border px-2">Contatos</th>
                  <th className="border px-2">E-mails</th>
                  <th className="border px-2">Telefones</th>
                  <th className="border px-2">Oportunidades</th>
                  <th className="border px-2">Cidade/UF</th>
                </tr>
              </thead>
              <tbody>
                {column.cards.map((card, index) => (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(p) => (
                      <tr
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className="border-t"
                      >
                        <td className="border px-2">{card.client.company}</td>
                        <td className="border px-2">
                          {card.client.contacts.map((c) => c.name).join(', ')}
                        </td>
                        <td className="border px-2">
                          {card.client.contacts.map((c) => c.email).join(' / ')}
                        </td>
                        <td className="border px-2">
                          {card.client.contacts
                            .flatMap((c) => c.normalizedPhones || [])
                            .join(' / ')}
                        </td>
                        <td className="border px-2">
                          {card.client.opportunities.join(', ')}
                        </td>
                        <td className="border px-2">
                          {[card.client.city, card.client.uf]
                            .filter(Boolean)
                            .join(' - ')}
                        </td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </tbody>
            </table>
          )}
        </Droppable>
      )}
    </div>
  );
}
