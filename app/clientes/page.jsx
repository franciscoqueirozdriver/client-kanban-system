'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';

export default function ClientesPage() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('card');
  const [filterState, setFilterState] = useState({ segmento: '', porte: [], uf: '', cidade: '' });

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients);
        setFiltered(data.clients);
      });
  }, []);

  const handleFilter = ({ segmento, porte, uf, cidade }) => {
    setFilterState({ segmento, porte, uf, cidade });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const { segmento, porte, uf, cidade } = filterState;
      let result = clients.filter((client) => {
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

      if (search) {
        const q = search.toLowerCase();
        const data = [
          client.company,
          client.city,
          client.uf,
          ...(client.opportunities || []),
          ...(client.contacts || []).flatMap((c) => [
            c.name || '',
            c.email || '',
            c.phone || '',
            ...(c.normalizedPhones || []),
          ]),
        ]
          .join(' ')
          .toLowerCase();
        if (!data.includes(q)) return false;
      }
      return true;
    });
      setFiltered(result);
    }, 300);
    return () => clearTimeout(timer);
  }, [clients, filterState, search]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Link href="/kanban" className="text-blue-600 underline">
          Ver Kanban
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="border p-2 rounded flex-1"
        />
        <button
          type="button"
          onClick={() => setView(view === 'card' ? 'list' : 'card')}
          className="border p-2 rounded"
        >
          {view === 'card' ? 'Ver Lista' : 'Ver Cards'}
        </button>
      </div>
      <Filters onFilter={handleFilter} />
      {view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-xs bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2">Empresa</th>
                <th className="border px-2">Contatos</th>
                <th className="border px-2">E-mails</th>
                <th className="border px-2">Telefones</th>
                <th className="border px-2">Oportunidades</th>
                <th className="border px-2">Cidade/UF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-t">
                  <td className="border px-2">{client.company}</td>
                  <td className="border px-2">
                    {client.contacts.map((c) => c.name).join(', ')}
                  </td>
                  <td className="border px-2">
                    {client.contacts.map((c) => c.email).join(' / ')}
                  </td>
                  <td className="border px-2">
                    {client.contacts
                      .flatMap((c) => c.normalizedPhones || [])
                      .join(' / ')}
                  </td>
                  <td className="border px-2">{client.opportunities.join(', ')}</td>
                  <td className="border px-2">
                    {[client.city, client.uf].filter(Boolean).join(' - ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

