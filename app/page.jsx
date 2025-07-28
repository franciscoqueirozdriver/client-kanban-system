'use client';
import { useEffect, useRef, useState } from 'react';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const chartRef = useRef(null);

  useEffect(() => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => setClients(data.clients || []));
  }, []);

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
  const lossRate = companies ? ((losses / companies) * 100).toFixed(1) : '0';

  useEffect(() => {
    const labels = phaseLabels;
    const data = labels.map((l) => phaseCounts[l] || 0);
    const colors = [
      '#fbbf24',
      '#34d399',
      '#60a5fa',
      '#c084fc',
      '#f87171',
      '#9ca3af',
    ];

    const createChart = () => {
      const canvas = document.getElementById('phaseChart');
      if (!canvas || !window.Chart) return;
      const ctx = canvas.getContext('2d');

      if (chartRef.current) {
        chartRef.current.destroy();
      }

      chartRef.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors }],
        },
        options: { plugins: { legend: { display: false } } },
      });
    };

    if (!window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = createChart;
      document.body.appendChild(script);
    } else {
      createChart();
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [clients]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Empresas</p>
          <p className="text-2xl font-bold">{companies}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Contatos Únicos</p>
          <p className="text-2xl font-bold">{contacts}</p>
        </div>
        {phaseLabels.map((label) => (
          <div key={label} className="bg-white p-4 rounded shadow">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{phaseCounts[label] || 0}</p>
          </div>
        ))}
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Taxa de Reuniões</p>
          <p className="text-2xl font-bold">{meetingRate}%</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Taxa de Perda</p>
          <p className="text-2xl font-bold">{lossRate}%</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <canvas id="phaseChart" height="200"></canvas>
      </div>
    </div>
  );
}
