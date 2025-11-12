'use client';
import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column }) {
  return (
    <div className="w-64">
      {/*
        Append the current number of cards to the column title.
        This updates automatically whenever the column prop changes,
        ensuring the count reflects drag-and-drop operations or refreshes.
      */}
      <h2 className="font-bold mb-2">
        {`${column.title} | ${column.cards.length}`}
      </h2>
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
    </div>
  );
}
