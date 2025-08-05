'use client';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Charts({ clients }) {
  const phaseLabels = [
    'Lead Selecionado',
    'Tentativa de Contato',
    'Contato Efetuado',
    'Conversa Iniciada',
    'Reunião Agendada',
    'Perdido',
  ];

  const phaseCounts = {};
  const segmentCounts = {};

  clients.forEach((c) => {
    phaseCounts[c.status] = (phaseCounts[c.status] || 0) + 1;
    if (c.segment) segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
  });
  const phaseData = {
    labels: phaseLabels,
    datasets: [
      {
        label: 'Contatos',
        data: phaseLabels.map((p) => phaseCounts[p] || 0),
        backgroundColor: [
          '#60a5fa',
          '#34d399',
          '#fbbf24',
          '#c084fc',
          '#f87171',
          '#9ca3af',
        ],
      },
    ],
  };

  const segmentData = {
    labels: Object.keys(segmentCounts),
    datasets: [
      {
        data: Object.values(segmentCounts),
        backgroundColor: ['#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#f87171', '#9ca3af'],
      },
    ],
  };

  const options = { plugins: { legend: { position: 'bottom' } } };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded shadow">
        <Doughnut data={phaseData} options={options} />
      </div>
      <div className="bg-white p-4 rounded shadow">
        <Doughnut data={segmentData} options={options} />
      </div>
    </div>
  );
}
