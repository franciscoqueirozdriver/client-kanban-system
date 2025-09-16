'use client';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  return (
    <section
      className="flex flex-col h-full w-[240px] flex-none rounded-xl min-h-0"
      role="listitem"
      aria-label={column.title}
    >
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur pb-2 pt-2">
        <h3 className="text-base font-semibold">
          {column.title}{' '}
          <span className="inline-block min-w-[3ch] text-neutral-600">
            | {column.cards.length}
          </span>
        </h3>
      </header>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-3 pr-1 pb-4"
          >
            {column.cards.length === 0 ? (
              <div className="rounded-md border border-dashed text-sm text-neutral-500 p-3 text-center">
                Sem cards
              </div>
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
