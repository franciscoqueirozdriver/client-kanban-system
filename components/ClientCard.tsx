'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import CardSurface from '@/components/cards/CardSurface';
import HistoryModal from '@/components/HistoryModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function displayPhone(phone: string) {
  return String(phone || '').replace(/^'+/, '');
}

function displayEmail(email: string) {
  return String(email || '').replace(/^'+/, '');
}

function resolveAccentColor(color?: string) {
  const accentMap: Record<string, string> = {
    green: 'hsl(var(--success))',
    red: 'hsl(var(--danger))',
    gray: 'hsl(var(--muted-foreground))',
    purple: 'hsl(var(--secondary))',
  };
  return accentMap[color ?? ''] || 'hsl(var(--primary))';
}

export interface ClientCardProps {
  client: any;
  onOpenSpotter?: (client: any, meta: any) => void;
}

export default function ClientCard({ client: initialClient, onOpenSpotter }: ClientCardProps) {
  const [client, setClient] = useState(initialClient);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [perdecompOpen, setPerdecompOpen] = useState(false);
  const router = useRouter();

  const queryValue = useMemo(() => {
    const raw = client?.cnpj || client?.CNPJ || client?.CNPJ_Empresa || '';
    const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');
    const clean = onlyDigits(raw);
    if (clean.length === 14) return clean;
    return (client?.company || client?.nome || client?.Nome_da_Empresa || '').trim();
  }, [client]);

  const accentColor = useMemo(() => resolveAccentColor(client?.color), [client?.color]);

  async function handleHistoryClick() {
    const response = await fetch(`/api/interacoes?clienteId=${client.id}`);
    const history = await response.json();
    setHistoryData(history);
    setHistoryOpen(true);
  }

  function handlePerdecompConfirm() {
    const base = '/consultas/perdecomp-comparativo';
    const url = `${base}?q=${encodeURIComponent(queryValue)}`;
    setPerdecompOpen(false);
    router.push(url);
  }

  return (
    <>
      <CardSurface
        accentColor={accentColor}
        className="flex h-full flex-col gap-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-primary/80"
        tabIndex={0}
        aria-roledescription="Cartão do cliente"
      >
        <div className="space-y-1">
          <h4 className="truncate text-base font-semibold text-foreground" title={client.company}>
            {client.company}
          </h4>
          {(client.city || client.uf) && (
            <p className="text-xs text-muted-foreground">{[client.city, client.uf].filter(Boolean).join(' - ')}</p>
          )}
        </div>

        {client.opportunities && client.opportunities.length > 0 && (
          <ul className="list-disc space-y-1 truncate pl-4 text-[11px] text-muted-foreground">
            {client.opportunities.map((opportunity: string, index: number) => (
              <li key={`${client.id}-opp-${index}`} className="break-words">
                {opportunity}
              </li>
            ))}
          </ul>
        )}

        {client.contacts && client.contacts.length > 0 && (
          <div className="space-y-3 text-xs">
            {client.contacts.map((contact: any, contactIndex: number) => (
              <div key={`${client.id}-contact-${contactIndex}`} className="border-t border-dashed border-border/70 pt-3">
                <p className="font-semibold text-foreground">{contact.name}</p>
                {contact.role && <p className="text-[11px] text-muted-foreground">{contact.role}</p>}
                {contact.email && (
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                    {contact.email.split(';').map((email: string, emailIndex: number) => (
                      <span key={`${client.id}-email-${contactIndex}-${emailIndex}`} className="flex items-center gap-1">
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-2 transition hover:text-primary/80 focus-visible:underline"
                        >
                          {displayEmail(email.trim())}
                        </button>
                        {emailIndex < contact.email.split(';').length - 1 && <span className="text-muted-foreground">/</span>}
                      </span>
                    ))}
                  </p>
                )}
                {contact.phone && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{displayPhone(contact.phone)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-3">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onOpenSpotter?.(client, {
                cardId: client.id,
                onUpdate: (update: any) => setClient((previous: any) => ({ ...previous, ...update })),
              });
            }}
            className="w-full rounded-xl"
          >
            Enviar ao Spotter
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-primary">
            <button
              type="button"
              className="font-medium underline-offset-4 transition hover:text-primary/80 focus-visible:underline"
              onClick={handleHistoryClick}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setPerdecompOpen(true)}
              className="font-medium underline-offset-4 transition hover:text-primary/80 focus-visible:underline"
            >
              Consultar PER/DCOMP
            </button>
          </div>
        </div>
      </CardSurface>

      <HistoryModal open={historyOpen} interactions={historyData} onClose={() => setHistoryOpen(false)} />

      <Dialog open={perdecompOpen} onOpenChange={setPerdecompOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <DialogTitle>Confirmar consulta PER/DCOMP</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-6 py-5 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Empresa:</span> {client.company || client.nome || client.Nome_da_Empresa || '—'}
            </div>
            {(client.cnpj || client.CNPJ || client.CNPJ_Empresa) && (
              <div>
                <span className="font-medium text-foreground">CNPJ:</span> {client.cnpj || client.CNPJ || client.CNPJ_Empresa}
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
