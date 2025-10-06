'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DoughnutChartProps {
  data: ChartData<'doughnut'>;
  options?: ChartOptions<'doughnut'>;
  title: string;
}

const defaultOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        boxWidth: 12,
        font: {
          size: 10,
        },
      },
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          let label = context.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed !== null) {
            label += context.parsed;
          }
          return label;
        },
      },
    },
  },
};

export default function DoughnutChart({ data, options, title }: DoughnutChartProps) {
  const chartOptions = { ...defaultOptions, ...options };

  return (
    <div className="relative h-48 w-full">
        <h4 className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      <Doughnut data={data} options={chartOptions} />
    </div>
  );
}