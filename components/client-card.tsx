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
  role?: string;
  email?: string;
  telefone?: string;
};

type ClientRecord = {
  id: string;
  company?: string;
  segment?: string;
  uf?: string;
  city?: string;
  opportunities?: string[];
  contacts?: ClientContact[];
  color?: string;
  cnpj?: string;
  [key: string]: unknown;
};

type ClientCardProps = {
  client: ClientRecord;
  onOpenSpotter?: (client: ClientRecord, meta: { cardId: string; onUpdate: (update: Partial<ClientRecord>) => void }) => void;
};

const accentPalette: Record<string, string> = {
  green: 'hsl(var(--success))',
  blue: 'hsl(var(--info))',
  purple: 'hsl(var(--primary))',
  orange: 'hsl(var(--warning))',
  red: 'hsl(var(--destructive))',
  gray: 'hsl(var(--muted-foreground))',
};

export default function ClientCard({ client, onOpenSpotter }: ClientCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const accentColor = useMemo(() => {
    const colorKey = client.color?.toLowerCase();
    return colorKey && accentPalette[colorKey] ? accentPalette[colorKey] : accentPalette.gray;
  }, [client.color]);

  const handleHistoryClick = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/interacoes?clienteId=${client.id}`);
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data.interactions || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
      setHistoryOpen(true);
    }
  };

  const handleOpenSpotter = () => {
    if (onOpenSpotter) {
      onOpenSpotter(client, {
        cardId: client.id,
        onUpdate: (update) => {
          // Callback para atualizar o cliente se necessário
          console.log('Cliente atualizado:', update);
        }
      });
    }
  };

  const handlePerdecompClick = () => {
    const cnpj = client.cnpj;
    const company = client.company;
    
    if (cnpj) {
      router.push(`/consultas/perdecomp-comparativo?q=${encodeURIComponent(cnpj)}`);
    } else if (company) {
      router.push(`/consultas/perdecomp-comparativo?q=${encodeURIComponent(company)}`);
    }
  };

  return (
    <>
      <div
        style={{ '--card-accent': accentColor } as Record<string, string>}
        className={cn(
          'relative mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-sm shadow transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          loading && 'pointer-events-none opacity-60',
          'hover:-translate-y-0.5 hover:shadow-lg'
        )}
        tabIndex={0}
        aria-roledescription="Cartão do cliente"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-4 left-0 w-1 rounded-full"
          style={{ background: 'var(--card-accent)' }}
        />
        
        <h4 className="text-base font-semibold text-foreground">
          {client.company || 'Cliente sem nome'}
        </h4>

        {(client.city || client.uf) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[client.city, client.uf].filter(Boolean).join(' - ')}
          </p>
        )}

        {Array.isArray(client.opportunities) && client.opportunities.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {client.opportunities.map((opportunity, index) => (
              <li key={`${client.id}-opp-${index}`}>{opportunity}</li>
            ))}
          </ul>
        )}

        {Array.isArray(client.contacts) && client.contacts.length > 0 && (
          <div className="space-y-3">
            {client.contacts.map((contact, index) => (
              <div key={`${client.id}-contact-${index}`} className="mt-3 border-t border-dashed border-border/70 pt-3 text-xs">
                <p className="font-semibold text-foreground">
                  {contact.name || 'Contato sem nome'}
                </p>
                {contact.role && (
                  <p className="text-[11px] text-muted-foreground">{contact.role}</p>
                )}

                {contact.email && (
                  <p className="mt-2 space-x-1 text-[11px]">
                    {contact.email.split(';').map((emailPart, emailIndex, arr) => (
                      <span key={`${client.id}-contact-${index}-email-${emailIndex}`}>
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-2 hover:text-primary/80 focus-visible:underline"
                        >
                          {displayEmail(emailPart.trim())}
                        </button>
                        {emailIndex < arr.length - 1 ? ' / ' : ''}
                      </span>
                    ))}
                  </p>
                )}

                {contact.telefone && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {displayPhone(contact.telefone)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium">
          <button
            type="button"
            onClick={handleHistoryClick}
            className="text-primary underline-offset-4 hover:text-primary/80 focus-visible:underline"
            disabled={loading}
          >
            Histórico
          </button>
          <button
            type="button"
            onClick={handlePerdecompClick}
            className="text-primary underline-offset-4 hover:text-primary/80 focus-visible:underline"
            title="Consultar PER/DCOMP"
          >
            Consultar PER/DCOMP
          </button>
        </div>

        <div className="mt-4">
          <Button 
            type="button" 
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={handleOpenSpotter}
            disabled={loading}
          >
            Enviar ao Spotter
          </Button>
        </div>
      </div>

      <HistoryModal
        open={historyOpen}
        interactions={historyData}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}
