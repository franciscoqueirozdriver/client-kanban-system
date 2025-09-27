'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useTheme } from '@/components/ThemeProvider';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const FALLBACK_COLORS = {
  primary: '#6B4EFF',
  secondary: '#9B8CFF',
  accent: '#22D3EE',
  success: '#34D399',
  warning: '#F59E0B',
  danger: '#F87171',
  card: '#FFFFFF',
  foreground: '#0F172A',
  muted: '#E2E8F0',
  mutedForeground: '#64748B',
  border: '#CBD5F5',
  background: '#FFFFFF',
};

function withAlpha(color, alpha) {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;
  if (color.startsWith('hsl(')) {
    return color.replace(/^hsl\((.*)\)$/, `hsla($1 / ${alpha})`);
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const value = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
    const int = Number.parseInt(value, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function useDesignTokens(theme) {
  const [colors, setColors] = useState(FALLBACK_COLORS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const style = getComputedStyle(document.documentElement);
    const read = (token, fallback) => {
      const value = style.getPropertyValue(`--${token}`).trim();
      return value ? `hsl(${value})` : fallback;
    };

    setColors({
      primary: read('primary', FALLBACK_COLORS.primary),
      secondary: read('secondary', FALLBACK_COLORS.secondary),
      accent: read('accent', FALLBACK_COLORS.accent),
      success: read('success', FALLBACK_COLORS.success),
      warning: read('warning', FALLBACK_COLORS.warning),
      danger: read('danger', FALLBACK_COLORS.danger),
      card: read('card', FALLBACK_COLORS.card),
      foreground: read('foreground', FALLBACK_COLORS.foreground),
      muted: read('muted', FALLBACK_COLORS.muted),
      mutedForeground: read('muted-foreground', FALLBACK_COLORS.mutedForeground),
      border: read('border', FALLBACK_COLORS.border),
      background: read('background', FALLBACK_COLORS.background),
    });
  }, [theme]);

  return colors;
}

export default function Charts({ clients = [] }) {
  const { resolvedTheme } = useTheme();
  const colors = useDesignTokens(resolvedTheme);

  const phaseLabels = useMemo(
    () => [
      'Lead Selecionado',
      'Tentativa de Contato',
      'Contato Efetuado',
      'Conversa Iniciada',
      'Reunião Agendada',
      'Proposta',
      'Negociação',
      'Vendido',
      'Perdido',
    ],
    [],
  );

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

    return { phasesData: phases, segmentsData: segments };
  }, [clients, phaseLabels]);

  const barData = useMemo(
    () => ({
      labels: phasesData.map((phase) => phase.status),
      datasets: [
        {
          label: 'Leads',
          data: phasesData.map((phase) => phase.total),
          backgroundColor: colors.primary,
          borderRadius: 12,
          barThickness: 24,
        },
      ],
    }),
    [phasesData, colors.primary],
  );

  const palette = useMemo(
    () => [colors.primary, colors.secondary, colors.accent, colors.success, colors.warning, colors.danger],
    [colors],
  );

  const doughnutData = useMemo(
    () => ({
      labels: segmentsData.map((segment) => segment.name),
      datasets: [
        {
          data: segmentsData.map((segment) => segment.value),
          backgroundColor: palette,
          borderColor: colors.background,
          borderWidth: 2,
        },
      ],
    }),
    [segmentsData, palette, colors.background],
  );

  const gridColor = withAlpha(colors.mutedForeground, 0.2);

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12, right: 16, bottom: 8, left: 8 } },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: colors.mutedForeground, maxRotation: 0, minRotation: 0, autoSkip: false, font: { size: 11 } },
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: colors.mutedForeground, precision: 0 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          titleColor: colors.foreground,
          bodyColor: colors.mutedForeground,
          padding: 12,
        },
      },
    }),
    [colors, gridColor],
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colors.mutedForeground,
            boxWidth: 12,
            usePointStyle: true,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          titleColor: colors.foreground,
          bodyColor: colors.mutedForeground,
          padding: 12,
        },
      },
      cutout: '60%',
    }),
    [colors],
  );

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Distribuição por etapa</h3>
        <div className="mt-3 h-72">
          {phasesData.every((phase) => phase.total === 0) ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados suficientes para exibir o gráfico.
            </p>
          ) : (
            <Bar data={barData} options={barOptions} aria-label="Distribuição de leads por etapa" />
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Segmentos mais frequentes
        </h3>
        <div className="mt-3 h-72">
          {segmentsData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem segmentos cadastrados.
            </p>
          ) : (
            <Doughnut data={doughnutData} options={doughnutOptions} aria-label="Segmentos mais frequentes" />
          )}
        </div>
      </div>
    </section>
  );
}
