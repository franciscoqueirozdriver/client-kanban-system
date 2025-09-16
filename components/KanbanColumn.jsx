'use client';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  return (
    <section className="flex flex-col gap-3 bg-gray-100 p-2 rounded-lg">
      <header>
        <h3 className="text-base font-semibold">
          {column.title}{' '}
          <span className="font-normal text-neutral-600">
            ({column.cards.length})
          </span>
        </h3>
      </header>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="min-h-[100px] flex-1"
          >
            {column.cards.map((card, index) => (
              <KanbanCard key={card.id} card={card} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
}
