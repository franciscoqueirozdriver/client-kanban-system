'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import HistoryModal, { type Interaction } from './HistoryModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function displayPhone(phone: string | null | undefined) {
  return String(phone || '').replace(/^'+/, '');
}

function displayEmail(email: string | null | undefined) {
  return String(email || '').replace(/^'+/, '');
}

type ClientContact = {
  name?: string;
  nome?: string;
  role?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
};

type ClientRecord = {
  id: string;
  company?: string;
  nome?: string;
  Nome_da_Empresa?: string;
  segment?: string;
  uf?: string;
  city?: string;
  opportunities?: string[];
  contacts?: ClientContact[];
  color?: string;
  cnpj?: string;
  CNPJ?: string;
  CNPJ_Empresa?: string;
  [key: string]: unknown;
};

type ClientCardProps = {
  client: ClientRecord;
  onOpenSpotter?: (client: ClientRecord, meta: { cardId: string; onUpdate: (update: Partial<ClientRecord>) => void }) => void;
};

const accentPalette: Record<string, string> = {
  green: 'hsl(var(--success))',
  red: 'hsl(var(--danger))',
  gray: 'hsl(var(--muted-foreground))',
  purple: 'hsl(var(--secondary))'
};

export default function ClientCard({ client: initialClient, onOpenSpotter }: ClientCardProps) {
  const [client, setClient] = useState<ClientRecord>(initialClient);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Interaction[]>([]);
  const [perdecompOpen, setPerdecompOpen] = useState(false);
  const router = useRouter();

  const queryValue = useMemo(() => {
    const raw =
      (client?.cnpj as string | undefined) ||
      (client?.CNPJ as string | undefined) ||
      (client?.CNPJ_Empresa as string | undefined) ||
      '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 14) {
      return digits;
    }
    return (
      (client?.company as string | undefined) ||
      (client?.nome as string | undefined) ||
      (client?.Nome_da_Empresa as string | undefined) ||
      ''
    ).trim();
  }, [client]);

  const accentColor = accentPalette[String(client?.color)] ?? 'hsl(var(--primary))';

  async function handleHistoryClick() {
    const response = await fetch(`/api/interacoes?clienteId=${client.id}`);
    const history = (await response.json()) as Interaction[];
    setHistoryData(history);
    setHistoryOpen(true);
  }

  function handleOpenSpotter() {
    onOpenSpotter?.(client, {
      cardId: client.id,
      onUpdate: (update) => setClient((prev) => ({ ...prev, ...update }))
    });
  }

  function handlePerdecompConfirm() {
    const url = `/consultas/perdecomp-comparativo?q=${encodeURIComponent(queryValue)}`;
    setPerdecompOpen(false);
    router.push(url);
  }

  return (
    <article
      style={{ '--card-accent': accentColor } as Record<string, string>}
      className={cn(
        'relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card p-5 text-sm shadow transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        'hover:-translate-y-1 hover:shadow-lg'
      )}
      tabIndex={0}
      aria-roledescription="Cartão do cliente"
    >
      <span aria-hidden="true" className="absolute inset-y-5 left-0 w-1 rounded-full" style={{ background: 'var(--card-accent)' }} />
      <div className="flex flex-col gap-1">
        <h3 className="truncate text-base font-semibold text-foreground" title={String(client.company ?? client.nome ?? '')}>
          {client.company || client.nome || client.Nome_da_Empresa || 'Cliente sem nome'}
        </h3>
        {(client.city || client.uf) && (
          <p className="text-xs text-muted-foreground">
            {[client.city, client.uf].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>

      {Array.isArray(client.opportunities) && client.opportunities.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {client.opportunities.map((opportunity, index) => (
            <li key={`${client.id}-opp-${index}`} className="truncate">
              {opportunity}
            </li>
          ))}
        </ul>
      ) : null}

      {Array.isArray(client.contacts) && client.contacts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {client.contacts.map((contact, index) => (
            <div key={`${client.id}-contact-${index}`} className="border-t border-dashed border-border/70 pt-3 text-xs">
              <p className="font-semibold text-foreground">
                {contact.name || contact.nome || 'Contato sem nome'}
              </p>
              {contact.role || contact.cargo ? (
                <p className="text-[11px] text-muted-foreground">{contact.role || contact.cargo}</p>
              ) : null}
              {contact.email ? (
                <p className="mt-2 space-x-1 text-[11px]">
                  {contact.email.split(';').map((emailPart, emailIndex, arr) => (
                    <span key={`${client.id}-contact-${index}-email-${emailIndex}`}>
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-2 hover:text-primary/80 focus-visible:underline"
                      >
                        {displayEmail(emailPart.trim())}
                      </button>
                      {emailIndex < arr.length - 1 ? ' / ' : null}
                    </span>
                  ))}
                </p>
              ) : null}
              {contact.telefone ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{displayPhone(contact.telefone)}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <Button type="button" className="w-full" onClick={handleOpenSpotter}>
          Enviar ao Spotter
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium text-primary">
          <button
            type="button"
            className="underline-offset-4 hover:text-primary/80 focus-visible:underline"
            onClick={handleHistoryClick}
          >
            Histórico
          </button>
          <button
            type="button"
            className="underline-offset-4 hover:text-primary/80 focus-visible:underline"
            onClick={() => setPerdecompOpen(true)}
          >
            Consultar PER/DCOMP
          </button>
        </div>
      </div>

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
    </article>
  );
}
