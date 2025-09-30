'use client';

import { cn } from '@/lib/cn';

export default function SummaryCard({ title, value, helper, trend = null }) {
  return (
    <article
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg focus-within:-translate-y-0.5 focus-within:shadow-lg"
      tabIndex={0}
      aria-label={`${title}: ${value}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/12 via-secondary/5 to-accent/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
      <div className="relative flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                trend.direction === 'up'
                  ? 'bg-success/15 text-success-foreground'
                  : trend.direction === 'down'
                  ? 'bg-danger/15 text-danger-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {trend.label}
            </span>
          )}
        </header>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {helper && <p className="text-sm text-muted-foreground">{helper}</p>}
      </div>
    </article>
  );
}
