'use client';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';
import KanbanListItem from './KanbanListItem';
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
                  <th className="border px-2 whitespace-nowrap">ID</th>
                  <th className="border px-2">Empresa</th>
                </tr>
              </thead>
              <tbody>
                {column.cards.map((card, index) => (
                  <KanbanListItem key={card.id} card={card} index={index} />
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
