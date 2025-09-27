'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  GaugeCircle,
  Menu,
  Moon,
  PanelsTopLeft,
  Settings2,
  Sun,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: GaugeCircle },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/kanban', label: 'Consultas (Kanban)', icon: PanelsTopLeft },
  { href: '/consultas/perdecomp-comparativo', label: 'PER/DCOMP Comparativo', icon: CircleDollarSign },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '#', label: 'Configurações', icon: Settings2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const ThemeIcon = resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-soft transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className={clsx(
            'fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm transition-opacity md:hidden',
            open ? 'opacity-100 pointer-events-auto' : 'pointer-events-none opacity-0',
          )}
        />
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card/95 px-6 py-6 shadow-soft backdrop-blur-lg transition-transform duration-300 md:translate-x-0 md:bg-card',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu principal"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            Consultas
          </div>
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Alternar tema"
            >
              <ThemeIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="mt-8 flex-1 space-y-1" role="navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-dashed border-border/60 bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Dica rápida</p>
          <p className="mt-1">
            Personalize as consultas e acompanhe o avanço das oportunidades em tempo real.
          </p>
        </div>
      </aside>
    </>
  );
}
