'use client';

import type { ReactNode } from 'react';

export type SummaryCardProps = {
  title: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
};

export default function SummaryCard({ title, value, helper, trend }: SummaryCardProps) {
  return (
    <article
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg focus-within:-translate-y-0.5 focus-within:shadow-lg"
      tabIndex={0}
      aria-label={`${title}: ${value}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/12 via-secondary/5 to-accent/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
      <div className="relative flex flex-col gap-3">
        <header className="flex items-center gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        </header>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {helper ? <div className="text-sm text-muted-foreground">{helper}</div> : null}
        {trend ? <div className="text-xs text-muted-foreground">{trend}</div> : null}
      </div>
    </article>
  );
}
