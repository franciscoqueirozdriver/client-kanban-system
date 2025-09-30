'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import HistoryModal from './HistoryModal';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Helper functions (can be extracted to a shared file if needed)
function displayPhone(phone: string) {
  return String(phone || '').replace(/^'+/, '');
}

function displayEmail(email: string) {
  return String(email || '').replace(/^'+/, '');
}

export default function ClientCard({ client: initialClient, onOpenSpotter }: { client: any, onOpenSpotter?: (client: any, meta: any) => void }) {
  const [client, setClient] = useState(initialClient);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [perdecompOpen, setPerdecompOpen] = useState(false);
  const router = useRouter();

  const queryValue = useMemo(() => {
    const raw = client?.cnpj || client?.CNPJ || client?.CNPJ_Empresa || '';
    const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');
    const clean = onlyDigits(raw);
    if (clean.length === 14) return clean;
    return (client?.company || client?.nome || client?.Nome_da_Empresa || '').trim();
  }, [client]);

  const handleHistoryClick = async () => {
    const res = await fetch(`/api/interacoes?clienteId=${client.id}`);
    const history = await res.json();
    setHistoryData(history);
    setHistoryOpen(true);
  };

  const handlePerdecompConfirm = () => {
    const base = '/consultas/perdecomp-comparativo';
    const url = `${base}?q=${encodeURIComponent(queryValue)}`;
    setPerdecompOpen(false);
    router.push(url);
  };

  const accentMap: { [key: string]: string } = {
    green: 'hsl(var(--success))',
    red: 'hsl(var(--danger))',
    gray: 'hsl(var(--muted-foreground))',
    purple: 'hsl(var(--secondary))',
  };

  const accentColor = accentMap[client.color] || 'hsl(var(--primary))';

  return (
    <>
      <div
        style={{ '--card-accent': accentColor }}
        className={cn(
          'relative mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-sm shadow transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
        )}
        tabIndex={0}
        aria-roledescription="Cartão do cliente"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-4 left-0 w-1 rounded-full"
          style={{ background: 'var(--card-accent)' }}
        />
        <h4 className="text-base font-semibold text-foreground truncate" title={client.company}>
          {client.company}
        </h4>

        {(client.city || client.uf) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[client.city, client.uf].filter(Boolean).join(' - ')}
          </p>
        )}

        {client.opportunities && client.opportunities.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {client.opportunities.map((o: string, i: number) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        )}

        {client.contacts && client.contacts.map((c: any, i: number) => (
          <div key={i} className="mt-3 border-t border-dashed border-border/70 pt-3 text-xs">
            <p className="font-semibold text-foreground">{c.name}</p>
            {c.role && <p className="text-[11px] text-muted-foreground">{c.role}</p>}
            {c.email && (
              <p className="mt-2 space-x-1 text-[11px]">
                {c.email.split(';').map((em: string, idx: number) => (
                  <span key={idx}>
                    <button type="button" className="font-medium text-primary underline-offset-2 hover:text-primary/80 focus-visible:underline">
                      {displayEmail(em.trim())}
                    </button>
                    {idx < c.email.split(';').length - 1 ? ' / ' : ''}
                  </span>
                ))}
              </p>
            )}
          </div>
        ))}

        <div className="mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenSpotter?.(client, {
                  cardId: client.id,
                  onUpdate: (update: any) => setClient((prev: any) => ({ ...prev, ...update })),
                });
              }}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Enviar esta oportunidade para o Exact Spotter"
            >
              Enviar ao Spotter
            </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-primary">
          <button type="button" className="font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline" onClick={handleHistoryClick}>
            Histórico
          </button>
          <button type="button" onClick={() => setPerdecompOpen(true)} className="font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline" title="Consultar PER/DCOMP">
            Consultar PER/DCOMP
          </button>
        </div>
      </div>

      <HistoryModal
        open={historyOpen}
        interactions={historyData}
        onClose={() => setHistoryOpen(false)}
      />

      <Dialog open={perdecompOpen} onOpenChange={setPerdecompOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <DialogTitle>Confirmar consulta PER/DCOMP</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Empresa:</span>{' '}
              {client.company || client.nome || client.Nome_da_Empresa || '—'}
            </div>
            {(client.cnpj || client.CNPJ || client.CNPJ_Empresa) && (
              <div>
                <span className="font-medium text-foreground">CNPJ:</span>{' '}
                {client.cnpj || client.CNPJ || client.CNPJ_Empresa}
              </div>
            )}
            <div className="pt-2">
              <span className="font-medium text-foreground">Será enviado:</span>{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">{queryValue || '—'}</code>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPerdecompOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handlePerdecompConfirm}>
              Sim, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}