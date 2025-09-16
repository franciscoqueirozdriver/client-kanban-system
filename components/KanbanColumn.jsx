'use client';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  return (
    <section className="flex flex-col flex-1 w-0 gap-3">
      <header className="sticky top-0 z-10 bg-gray-100 pb-2 pt-2">
        <h3 className="text-base font-semibold">
          {column.title}{' '}
          <span className="font-normal text-neutral-600 inline-block min-w-[3ch]">
            | {column.cards.length}
          </span>
        </h3>
      </header>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="min-h-[100px] p-2 bg-gray-100 rounded flex-1"
          >
            {column.cards.length === 0 ? (
              <div className="text-sm text-neutral-500 py-2">Sem cards</div>
            ) : (
              column.cards.map((card, index) => (
                <KanbanCard key={card.id} card={card} index={index} />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
}
