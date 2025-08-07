'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import KanbanColumn from '../../components/KanbanColumn';
import Filters from '../../components/Filters';

export default function KanbanPage() {
  const [columns, setColumns] = useState([]);
  const [filteredColumns, setFilteredColumns] = useState(null);

  // Buscar dados ao montar
  useEffect(() => {
    fetchColumns();
  }, []);

  // Sempre que columns mudar, reseta o filtro
  useEffect(() => {
    setFilteredColumns(null);
  }, [columns]);

  const fetchColumns = async () => {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    setColumns(data);
  };

  const handleFilter = ({ query, segmento, porte, uf, cidade }) => {
    // Função de filtro
    const filterFn = (client) => {
      // segmento
      if (segmento && segmento.trim()) {
        if ((client.segment || '').trim().toLowerCase() !== segmento.trim().toLowerCase()) {
          return false;
        }
      }

      // porte
      if (porte) {
        if (Array.isArray(porte)) {
          if (porte.length > 0) {
            const options = porte.map((p) => p.trim().toLowerCase());
            if (!options.includes((client.size || '').trim().toLowerCase())) return false;
          }
        } else if (porte.trim()) {
          if ((client.size || '').trim().toLowerCase() !== porte.trim().toLowerCase()) return false;
        }
      }

      // uf
      if (uf && uf.trim()) {
        if ((client.uf || '').trim().toLowerCase() !== uf.trim().toLowerCase()) return false;
      }

      // cidade
      if (cidade && cidade.trim()) {
        if ((client.city || '').trim().toLowerCase() !== cidade.trim().toLowerCase()) return false;
      }

      // query de texto
      if (query) {
        const q = query.toLowerCase();
        const matchName = (client.company || '').toLowerCase().includes(q);
        const matchContact = (client.contacts || []).some((c) =>
          (c.name || c.nome || '').toLowerCase().includes(q)
        );
        const matchOpp = (client.opportunities || []).some((o) =>
          (o || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchContact && !matchOpp) return false;
      }
      return true;
    };

    // Aplica o filtro em todas as colunas
    const newFiltered = columns.map(col => ({
      ...col,
      cards: col.cards.filter(card => filterFn(card.client))
    }));

    // Se o filtro resultar em todas as colunas vazias, mostra vazio (poderia ser um estado especial se quiser)
    setFilteredColumns(newFiltered);
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const newColumns = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    const [moved] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, moved);

    const newStatus = destCol.id;
    let newColor = moved.client.color;

    if (newStatus === 'Perdido') {
      newColor = 'red';
    } else if (newStatus === 'Lead Selecionado') {
      newColor = 'green';
    }

    moved.client.status = newStatus;
    moved.client.color = newColor;

    const resp = await fetch('/api/interacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: draggableId,
        tipo: 'Mudança de Fase',
        deFase: source.droppableId,
        paraFase: destination.droppableId,
      }),
    });

    if (!resp.ok) {
      await fetchColumns();
      return;
    }

    setColumns(newColumns);

    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draggableId, status: newStatus, color: newColor }),
    });
  };

  const columnsToShow = filteredColumns ?? columns;

  return (
    <div className="p-4 overflow-x-auto">
      <div className="mb-4">
        <Filters onFilter={handleFilter} />
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {columnsToShow.map((col) => (
            <KanbanColumn key={col.id} column={col} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
