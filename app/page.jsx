'use client';
import { useEffect, useState, useCallback } from 'react';
import SummaryCard from '../components/SummaryCard';
import Charts from '../components/Charts';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [options, setOptions] = useState({ segmento: [], uf: [] });
  const [filters, setFilters] = useState({ segmento: '', uf: '' });
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async (currentFilters) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentFilters.segmento) params.append('segmento', currentFilters.segmento);
    if (currentFilters.uf) params.append('uf', currentFilters.uf);

    const res = await fetch(`/api/clientes?${params.toString()}`);
    const data = await res.json();

    setClients(data.clients || []);
    // Set options only once on the first load
    if (options.segmento.length === 0 && data.filters?.segmento) {
      setOptions({ segmento: data.filters.segmento, uf: data.filters.uf });
    }
    setLoading(false);
  }, [options.segmento.length]); // Dependency ensures options are not reset on subsequent fetches

  useEffect(() => {
    fetchClients(filters);
  }, [filters, fetchClients]);

  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const phaseLabels = [
    'Lead Selecionado',
    'Tentativa de Contato',
    'Contato Efetuado',
    'Conversa Iniciada',
    'Reunião Agendada',
    'Perdido',
  ];

  const phaseCounts = clients.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const companies = clients.length;
  const contactsSet = new Set();
  clients.forEach((c) => {
    c.contacts.forEach((ct) => {
      contactsSet.add(`${ct.nome}|${ct.email}`);
    });
  });
  const contacts = contactsSet.size;

  const funnelPhases = [
    'Lead Selecionado',
    'Tentativa de Contato',
    'Contato Efetuado',
    'Conversa Iniciada',
  ];
  const funnelTotal = funnelPhases.reduce((s, p) => s + (phaseCounts[p] || 0), 0);
  const meetings = phaseCounts['Reunião Agendada'] || 0;
  const losses = phaseCounts['Perdido'] || 0;
  const meetingRate = funnelTotal ? ((meetings / funnelTotal) * 100).toFixed(1) : '0';
  const lossRate = funnelTotal ? ((losses / funnelTotal) * 100).toFixed(1) : '0';


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="flex gap-2 flex-wrap">
        <select
          value={filters.segmento}
          onChange={(e) => handleChange('segmento', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Segmento</option>
          {options.segmento.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.uf}
          onChange={(e) => handleChange('uf', e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">UF</option>
          {options.uf.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="text" placeholder="Data Range" className="border p-2 rounded" disabled />
      </div>
      {loading ? <p>Carregando...</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <SummaryCard title="Empresas" value={companies} />
            <SummaryCard title="Contatos Únicos" value={contacts} />
            {phaseLabels.map((label) => (
              <SummaryCard key={label} title={label} value={phaseCounts[label] || 0} />
            ))}
            <SummaryCard title="Taxa de Reuniões" value={`${meetingRate}%`} />
            <SummaryCard title="Taxa de Perda" value={`${lossRate}%`} />
          </div>
          <Charts clients={clients} />
        </>
      )}
    </div>
  );
}
