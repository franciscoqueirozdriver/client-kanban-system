'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';

export default function ClientesPage() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.clients) ? data.clients : [];
        setClients(list);
        setFiltered(list);
        setFilterOptions(data.filters || {});
      });
  }, []);

  const handleFilter = ({
    query,
    segmento,
    porte,
    uf,
    cidade,
    proprietario,
    status,
  }) => {
    let result = (clients || []).filter((client) => {
      // segmento filter
      if (segmento && segmento.trim()) {
        if ((client.segment || '').trim().toLowerCase() !== segmento.trim().toLowerCase()) {
          return false;
        }
      }

      // porte filter - supports array or string
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

      // uf filter
      if (uf && uf.trim()) {
        if ((client.uf || '').trim().toLowerCase() !== uf.trim().toLowerCase()) return false;
      }

      // cidade filter
      if (cidade && cidade.trim()) {
        if ((client.city || '').trim().toLowerCase() !== cidade.trim().toLowerCase()) return false;
      }

      // negócio - proprietário filter
      if (proprietario && proprietario.trim()) {
        if ((client.owner || '').trim().toLowerCase() !== proprietario.trim().toLowerCase()) return false;
      }

      // negócio - status filter
      if (status && status.trim()) {
        if ((client.dealStatus || '').trim().toLowerCase() !== status.trim().toLowerCase()) return false;
      }

      // query filter
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
    });

    setFiltered(result);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Link href="/kanban" className="text-blue-600 underline">
          Ver Kanban
        </Link>
      </div>
      <Filters onFilter={handleFilter} filters={filterOptions} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(filtered || []).map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}

