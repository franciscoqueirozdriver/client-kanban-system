'use client';
import { useEffect, useState } from 'react';
import SummaryCard from '../components/SummaryCard';
import Charts from '../components/Charts';
import { getSegmento, asArray } from '@/lib/ui/safe';

export default function Dashboard() {
  const [allClients, setAllClients] = useState([]);
  const [clients, setClients] = useState([]);
  const [options, setOptions] = useState({ segmento: [], uf: [] });
  const [filters, setFilters] = useState({ segmento: '', uf: '' });

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        const safeClients = asArray(data.clients);
        setAllClients(safeClients);
        setClients(safeClients);
        setOptions({ segmento: asArray(data.filters.segmento), uf: asArray(data.filters.uf) });
      });
  }, []);

  useEffect(() => {
    let filtered = allClients;
    if (filters.segmento) filtered = filtered.filter((c) => getSegmento(c) === filters.segmento);
    if (filters.uf) filtered = filtered.filter((c) => c.uf === filters.uf);
    setClients(filtered);
  }, [filters, allClients]);

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
    asArray(c.contacts).forEach((ct) => {
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

  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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
          {asArray(options.segmento).map((s) => (
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
          {asArray(options.uf).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="text" placeholder="Data Range" className="border p-2 rounded" disabled />
      </div>
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
    </div>
  );
}
