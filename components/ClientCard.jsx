'use client';
import { useState } from 'react';
import { useCardInteractions } from '@/hooks/useCardInteractions';
import AlertDialog from './AlertDialog';
import clsx from 'clsx';
import { MoveRight } from 'lucide-react';

function displayPhone(phone) {
  return String(phone || '').replace(/^'+/, ''); // remove proteção visualmente
}

function displayEmail(email) {
  return String(email || '').replace(/^'+/, '');
}

function getWhatsAppLink(phone) {
  const clean = displayPhone(phone);
  const digits = clean.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return digits
    ? `https://web.whatsapp.com/send/?phone=${number}&type=phone_number&app_absent=0`
    : '';
}

export default function ClientCard({ client, onStatusChange }) {
  const [color, setColor] = useState(client.color || '');
  const [status, setStatus] = useState(client.status || '');
  const [updating, setUpdating] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', description: '' });

  const { handleHistoryClick, handlePhoneClick, handleEmailClick, handleLinkedinClick, Modals } =
    useCardInteractions(client);

  const handleMoveToLeads = async () => {
    if (updating || status === 'Lead Selecionado') return;
    const prevColor = color;
    const prevStatus = status;
    const newColor = 'green';
    const newStatus = 'Lead Selecionado';
    setColor(newColor);
    setStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(client.id, newStatus, newColor);
    }
    setUpdating(true);
    try {
      const res = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          status: newStatus,
          color: newColor,
        }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
      await res.json();
      // TODO: This should probably trigger a global state refresh, not a direct fetch
      await fetch('/api/kanban');
    } catch (err) {
      setColor(prevColor);
      setStatus(prevStatus);
      if (onStatusChange) {
        onStatusChange(client.id, prevStatus, prevColor);
      }
      setAlertInfo({
        isOpen: true,
        title: 'Erro ao Atualizar',
        description: 'Não foi possível mover o cliente para a lista de leads. Tente novamente.',
      });
    } finally {
      setUpdating(false);
    }
  };

  const cardClasses = clsx(
    'relative rounded-2xl border p-4 transition-shadow duration-200 hover:shadow-soft',
    {
      'border-success/40 bg-success/5': color === 'green',
      'border-danger/40 bg-danger/5': color === 'red',
      'border-muted-foreground/40 bg-muted/20': color === 'gray',
      'border-secondary/40 bg-secondary/5': color === 'purple',
      'border-border bg-card': !color,
    },
    updating && 'pointer-events-none opacity-60',
  );

  const accentClasses = clsx('absolute inset-y-4 left-0 w-1 rounded-full', {
    'bg-success': color === 'green',
    'bg-danger': color === 'red',
    'bg-muted-foreground': color === 'gray',
    'bg-secondary': color === 'purple',
    'bg-primary': !color,
  });

  return (
    <>
      <div className={cardClasses}>
        <span aria-hidden="true" className={accentClasses} />
        <div className="pl-4">
          <h3 className="text-base font-semibold text-foreground">{client.company}</h3>
          {(client.city || client.uf) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[client.city, client.uf].filter(Boolean).join(' - ')}
            </p>
          )}
          {client.opportunities.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {client.opportunities.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-3">
            {client.contacts.map((c, idx) => (
              <div key={idx} className="border-t border-dashed border-border/70 pt-3 text-xs">
                <p className="font-semibold text-foreground">{c.name}</p>
                {c.role && <p className="text-[11px] text-muted-foreground">{c.role}</p>}

                {c.email && (
                  <p className="mt-2 space-x-1 text-[11px]">
                    {c.email.split(';').map((em, i) => {
                      const clean = displayEmail(em.trim());
                      return (
                        <span key={i}>
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:text-primary/80 focus-visible:underline"
                            onClick={(e) => handleEmailClick(e, clean, c)}
                          >
                            {clean}
                          </button>
                          {i < c.email.split(';').length - 1 ? ' / ' : ''}
                        </span>
                      );
                    })}
                  </p>
                )}

                {c.normalizedPhones && c.normalizedPhones.length > 0 && (
                  <p className="mt-2 space-x-1 text-[11px]">
                    {c.normalizedPhones.map((p, i) => (
                      <span key={i}>
                        <a
                          href={getWhatsAppLink(p)}
                          className="font-medium text-success underline-offset-2 hover:text-success/80 focus-visible:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handlePhoneClick(e, p, c)}
                        >
                          {displayPhone(p)}
                        </a>
                        {i < c.normalizedPhones.length - 1 ? ' / ' : ''}
                      </span>
                    ))}
                  </p>
                )}

                {c.linkedin && (
                  <p className="mt-2">
                    <a
                      href={c.linkedin}
                      className="font-medium text-accent underline-offset-2 hover:text-accent/80 focus-visible:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => handleLinkedinClick(e, c.linkedin, c)}
                    >
                      LinkedIn
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-4 hover:text-primary/80 focus-visible:underline"
              onClick={handleHistoryClick}
            >
              Histórico
            </button>

            {status !== 'Lead Selecionado' && (
              <button
                type="button"
                onClick={handleMoveToLeads}
                disabled={updating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                Mover para Leads
                <MoveRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      <Modals />
      <AlertDialog
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, title: '', description: '' })}
        title={alertInfo.title}
        description={alertInfo.description}
      />
    </>
  );
}
