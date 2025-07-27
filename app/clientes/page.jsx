'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';

export default function ClientesPage() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients);
        setFiltered(data.clients);
      });
  }, []);

  const handleFilter = ({ query, segmento, porte, uf, cidade }) => {
    let result = clients.filter((client) => {
      if (segmento && client.segment !== segmento) return false;
      if (porte && client.size !== porte) return false;
      if (uf && client.uf !== uf) return false;
      if (cidade && client.city !== cidade) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchName = client.company.toLowerCase().includes(q);
        const matchContact = client.contacts.some((c) => c.nome.toLowerCase().includes(q));
        const matchOpp = client.opportunities.some((o) => o.toLowerCase().includes(q));
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
      <Filters onFilter={handleFilter} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}
