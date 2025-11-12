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

    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    const getHSLValue = (variable) => {
      const value = computedStyle.getPropertyValue(variable).trim();
      return value ? `hsl(${value})` : null;
    };

    const newColors = {
      primary: getHSLValue('--primary') || FALLBACK_COLORS.primary,
      secondary: getHSLValue('--secondary') || FALLBACK_COLORS.secondary,
      accent: getHSLValue('--accent') || FALLBACK_COLORS.accent,
      success: getHSLValue('--success') || FALLBACK_COLORS.success,
      warning: getHSLValue('--warning') || FALLBACK_COLORS.warning,
      danger: getHSLValue('--destructive') || FALLBACK_COLORS.danger,
      card: getHSLValue('--card') || FALLBACK_COLORS.card,
      foreground: getHSLValue('--foreground') || FALLBACK_COLORS.foreground,
      muted: getHSLValue('--muted') || FALLBACK_COLORS.muted,
      mutedForeground: getHSLValue('--muted-foreground') || FALLBACK_COLORS.mutedForeground,
      border: getHSLValue('--border') || FALLBACK_COLORS.border,
      background: getHSLValue('--background') || FALLBACK_COLORS.background,
    };

    setColors(newColors);
  }, [theme]);

  return colors;
}

export default function Charts({ clients = [] }) {
  const { theme } = useTheme();
  const colors = useDesignTokens(theme);

  const phasesData = useMemo(() => {
    const phases = [
      'Lead Selecionado',
      'Tentativa de Contato',
      'Contato Efetuado',
      'Conversa Iniciada',
      'Reunião Agendada',
      'Perdido',
    ];

    return phases.map((phase) => ({
      phase,
      total: clients.filter((client) => client.status === phase).length,
    }));
  }, [clients]);

  const segmentsData = useMemo(() => {
    const segmentCounts = clients.reduce((acc, client) => {
      const segment = client.segment || 'Não informado';
      acc[segment] = (acc[segment] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(segmentCounts)
      .map(([segment, count]) => ({ segment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [clients]);

  const barData = useMemo(
    () => ({
      labels: phasesData.map((phase) => phase.phase),
      datasets: [
        {
          label: 'Quantidade de leads',
          data: phasesData.map((phase) => phase.total),
          backgroundColor: withAlpha(colors.primary, 0.8),
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    }),
    [phasesData, colors],
  );

  const doughnutData = useMemo(
    () => ({
      labels: segmentsData.map((segment) => segment.segment),
      datasets: [
        {
          data: segmentsData.map((segment) => segment.count),
          backgroundColor: [
            withAlpha(colors.primary, 0.8),
            withAlpha(colors.secondary, 0.8),
            withAlpha(colors.accent, 0.8),
            withAlpha(colors.success, 0.8),
            withAlpha(colors.warning, 0.8),
            withAlpha(colors.danger, 0.8),
            withAlpha(colors.muted, 0.8),
            withAlpha(colors.mutedForeground, 0.8),
          ],
          borderColor: colors.card,
          borderWidth: 2,
        },
      ],
    }),
    [segmentsData, colors],
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: colors.card,
          titleColor: colors.foreground,
          bodyColor: colors.foreground,
          borderColor: colors.border,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: {
            color: colors.mutedForeground,
            font: { size: 11 },
          },
          grid: {
            color: withAlpha(colors.border, 0.3),
          },
        },
        y: {
          ticks: {
            color: colors.mutedForeground,
            font: { size: 11 },
          },
          grid: {
            color: withAlpha(colors.border, 0.3),
          },
        },
      },
      layout: {
        padding: 12,
      },
    }),
    [colors],
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
            font: { size: 11 },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: colors.card,
          titleColor: colors.foreground,
          bodyColor: colors.foreground,
          borderColor: colors.border,
          borderWidth: 1,
        },
      },
      layout: {
        padding: 12,
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
