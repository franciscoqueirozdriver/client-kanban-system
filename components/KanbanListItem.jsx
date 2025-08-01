'use client';
import { Draggable } from '@hello-pangea/dnd';

export default function KanbanListItem({ card, index }) {
  const { client } = card;
  const backgroundColor =
    client.color === 'green'
      ? '#a3ffac'
      : client.color === 'red'
      ? '#ffca99'
      : 'white';

  const borderLeftColor =
    client.color === 'green'
      ? '#4caf50'
      : client.color === 'red'
      ? '#ff7043'
      : 'transparent';

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            backgroundColor,
            borderLeft: `4px solid ${borderLeftColor}`,
          }}
          className="border-t text-xs"
        >
          <td className="border px-2 whitespace-nowrap">{card.id}</td>
          <td className="border px-2">{client.company}</td>
        </tr>
      )}
    </Draggable>
  );
}
