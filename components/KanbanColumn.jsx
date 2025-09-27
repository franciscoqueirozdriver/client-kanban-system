'use client';

import { Droppable } from '@hello-pangea/dnd';
import clsx from 'clsx';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  const headerId = `${column.id}-heading`;

  return (
    <section
      className="flex h-full min-h-0 w-[280px] flex-none flex-col rounded-3xl border border-border bg-muted/40 backdrop-blur"
      aria-labelledby={headerId}
      role="listitem"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-3xl border-b border-border/70 bg-muted/60 px-4 py-4 backdrop-blur">
        <h3 id={headerId} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {column.title}
        </h3>
        <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-card px-2 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
          {column.cards.length}
        </span>
      </header>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(
              'flex-1 min-h-0 space-y-3 overflow-y-auto px-3 pb-6 pt-4 scrollbar-thin',
              snapshot.isDraggingOver && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
            )}
            aria-live="polite"
          >
            {column.cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-4 text-center text-sm text-muted-foreground">
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
