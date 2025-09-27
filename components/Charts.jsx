'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const palette = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--danger))',
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color || entry.payload.fill || 'hsl(var(--primary))' }}
          />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Charts({ clients = [] }) {
  const phaseLabels = [
    'Lead Selecionado',
    'Tentativa de Contato',
    'Contato Efetuado',
    'Conversa Iniciada',
    'Reunião Agendada',
    'Proposta',
    'Negociação',
    'Vendido',
    'Perdido',
  ];

  const { phasesData, segmentsData } = useMemo(() => {
    const phaseCounts = new Map();
    const segmentCounts = new Map();

    clients.forEach((client) => {
      const status = client.status || 'Sem status';
      phaseCounts.set(status, (phaseCounts.get(status) ?? 0) + 1);
      if (client.segment) {
        segmentCounts.set(client.segment, (segmentCounts.get(client.segment) ?? 0) + 1);
      }
    });

    const phases = phaseLabels.map((status) => ({
      status,
      total: phaseCounts.get(status) ?? 0,
    }));

    const segments = Array.from(segmentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    return {
      phasesData: phases,
      segmentsData: segments,
    };
  }, [clients]);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Distribuição por etapa
        </h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phasesData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
              <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} angle={-15} dy={10} interval={0} height={70} tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} />
              <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Segmentos mais frequentes
        </h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <RechartsTooltip content={<ChartTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                verticalAlign="bottom"
                iconType="circle"
              />
              <Pie
                data={segmentsData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {segmentsData.map((entry, index) => (
                  <Cell key={entry.name} fill={palette[index % palette.length]} stroke="hsl(var(--background))" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
