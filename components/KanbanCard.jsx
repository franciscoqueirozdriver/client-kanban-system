'use client';
import { Draggable } from '@hello-pangea/dnd';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCardInteractions } from '@/hooks/useCardInteractions';
import SpotterModal from './SpotterModal';
import ConfirmDialog from './ConfirmDialog';
import AlertDialog from './AlertDialog';
import { onlyDigits, isValidCNPJ } from '@/utils/cnpj';
import clsx from 'clsx';
import { Database } from 'lucide-react';

function displayPhone(phone) {
  return String(phone || '').replace(/^'+/, '');
}

function displayEmail(email) {
  return String(email || '').replace(/^'+/, '');
}

export default function KanbanCard({ card, index }) {
  const [client, setClient] = useState(card.client);
  const [loading, setLoading] = useState(false);
  const [perdecompOpen, setPerdecompOpen] = useState(false);
  const [isSpotterModalOpen, setIsSpotterModalOpen] = useState(false);
  const [isEnrichConfirmOpen, setIsEnrichConfirmOpen] = useState(false);
  const [isOverwriteConfirmOpen, setIsOverwriteConfirmOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', description: '' });
  const router = useRouter();

  const { handleHistoryClick, handlePhoneClick, handleEmailClick, handleLinkedinClick, Modals } =
    useCardInteractions(client);

  const queryValue = useMemo(() => {
    const raw =
      client?.cnpj ||
      client?.CNPJ ||
      client?.CNPJ_Empresa ||
      '';
    const clean = onlyDigits(raw);
    if (clean.length === 14 && isValidCNPJ(clean)) return clean;
    const name =
      client?.company ||
      client?.nome ||
      client?.Nome_da_Empresa ||
      '';
    return name.trim();
  }, [client]);

  const handlePerdecompConfirm = () => {
    const base = '/consultas/perdecomp-comparativo';
    const url = `${base}?q=${encodeURIComponent(queryValue)}`;
    setPerdecompOpen(false);
    router.push(url);
  };

  const handleEnrichClick = () => {
    if (loading) return;
    setIsEnrichConfirmOpen(true);
  };

  const handleEnrichConfirm = async (overwrite = false) => {
    setIsEnrichConfirmOpen(false);
    setIsOverwriteConfirmOpen(false);
    try {
      setLoading(true);
      const payload = {
        clienteId: client?.id,
        nome: client?.company || client?.nome || '',
        estado: client?.uf || '',
        cidade: client?.city || '',
        cep: client?.cep || '',
        overwrite,
      };

      const res = await fetch('/api/enriquecer-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.exists && !overwrite) {
        setIsOverwriteConfirmOpen(true);
        setLoading(false);
        return;
      }

      if (!json.ok) {
        throw new Error(json.error || 'Falha ao enriquecer empresa');
      }

      await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, status: 'Lead Importado', color: 'gray' }),
      });
      setClient((prev) => ({ ...prev, ...json.data, status: 'Lead Importado', color: 'gray' }));

      console.log('Enriquecimento concluído:', json.data);
      setAlertInfo({
        isOpen: true,
        title: 'Enriquecimento Concluído',
        description: 'Os dados da empresa foram atualizados e salvos com sucesso.',
      });
    } catch (err) {
      console.error('Erro no enriquecimento:', err);
      setAlertInfo({
        isOpen: true,
        title: 'Erro ao Enriquecer',
        description: err?.message || 'Ocorreu uma falha ao tentar enriquecer os dados.',
      });
    } finally {
      setLoading(false);
    }
  };

  const accentMap = {
    green: 'hsl(var(--success))',
    red: 'hsl(var(--danger))',
    gray: 'hsl(var(--muted-foreground))',
    purple: 'hsl(var(--secondary))',
  };

  const accentColor = accentMap[client.color] || 'hsl(var(--primary))';

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <>
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={{
              ...provided.draggableProps.style,
              '--card-accent': accentColor,
            }}
            className={clsx(
              'relative mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-sm shadow transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              loading && 'pointer-events-none opacity-60',
              snapshot.isDragging && 'ring-2 ring-primary/60 shadow-soft',
            )}
            tabIndex={0}
            aria-roledescription="Cartão do kanban"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-4 left-0 w-1 rounded-full"
              style={{ background: 'var(--card-accent)' }}
            />
            <h4 className="text-base font-semibold text-foreground">{client.company}</h4>

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

            {client.contacts.map((c, i) => (
              <div key={i} className="mt-3 border-t border-dashed border-border/70 pt-3 text-xs">
                <p className="font-semibold text-foreground">{c.name}</p>
                {c.role && <p className="text-[11px] text-muted-foreground">{c.role}</p>}

                {c.email && (
                  <p className="mt-2 space-x-1 text-[11px]">
                    {c.email.split(';').map((em, idx) => {
                      const clean = displayEmail(em.trim());
                      return (
                        <span key={idx}>
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:text-primary/80 focus-visible:underline"
                            onClick={(e) => handleEmailClick(e, clean, c)}
                          >
                            {clean}
                          </button>
                          {idx < c.email.split(';').length - 1 ? ' / ' : ''}
                        </span>
                      );
                    })}
                  </p>
                )}

                {c.normalizedPhones && c.normalizedPhones.length > 0 && (
                  <p className="mt-2 space-x-1 text-[11px]">
                    {c.normalizedPhones.map((p, idx) => (
                      <span key={idx}>
                        <a
                          href={`https://web.whatsapp.com/send/?phone=${displayPhone(p)
                            .replace(/\D/g, '')
                            .replace(
                              /^/,
                              (d) => (d.startsWith('55') ? d : `55${d}`),
                            )}&type=phone_number&app_absent=0`}
                          className="font-medium text-success underline-offset-2 hover:text-success/80 focus-visible:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handlePhoneClick(e, p, c)}
                        >
                          {displayPhone(p)}
                        </a>
                        {idx < c.normalizedPhones.length - 1 ? ' / ' : ''}
                      </span>
                    ))}
                  </p>
                )}

                {c.linkedin && (
                  <p className="mt-2">
                    <a
                      href={c.linkedin}
                      className="font-medium text-accent underline-offset-4 hover:text-accent/80 focus-visible:underline"
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
            <div className="mt-4">
              <button
                onClick={() => setIsSpotterModalOpen(true)}
                className="w-full rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-foreground hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Enviar esta oportunidade para o Exact Spotter"
              >
                Enviar ao Spotter
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-primary">
              <button
                type="button"
                className="text-[11px] font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline"
                onClick={handleHistoryClick}
              >
                Histórico
              </button>
              <button
                type="button"
                onClick={() => setPerdecompOpen(true)}
                className="text-[11px] font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline"
                aria-label="Consultar PER/DCOMP para este cliente"
                data-testid="cta-perdecomp"
                title="Consultar PER/DCOMP"
              >
                Consultar PER/DCOMP
              </button>
              <button
                type="button"
                onClick={handleEnrichClick}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline"
                title="Enriquecer dados da empresa"
              >
                <Database className="h-3 w-3" />
                Enriquecer
              </button>
            </div>
          </div>
          <Modals />
          <SpotterModal
            isOpen={isSpotterModalOpen}
            onClose={() => setIsSpotterModalOpen(false)}
            initialData={client}
            onSent={(update) => {
              setClient((prev) => ({ ...prev, ...update }));
            }}
          />
          {isEnrichConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
              <div className="w-11/12 max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-center text-foreground">
                  Confirmar Enriquecimento
                </h2>
                <p className="mt-3 text-sm text-center text-muted-foreground">
                  Deseja buscar e atualizar os dados para a empresa{' '}
                  <span className="font-bold">{client.company}</span>?
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setIsEnrichConfirmOpen(false)}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleEnrichConfirm(false)}
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Sim, enriquecer
                  </button>
                </div>
              </div>
            </div>
          )}
          <ConfirmDialog
            isOpen={isOverwriteConfirmOpen}
            onClose={() => setIsOverwriteConfirmOpen(false)}
            onConfirm={() => handleEnrichConfirm(true)}
            title="Confirmar Sobrescrita"
            description="Este cliente já existe em outra lista. Deseja sobrescrever os dados com o enriquecimento?"
            confirmText="Sim, sobrescrever"
          />
          <AlertDialog
            isOpen={alertInfo.isOpen}
            onClose={() => setAlertInfo({ isOpen: false, title: '', description: '' })}
            title={alertInfo.title}
            description={alertInfo.description}
          />
          {perdecompOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
              <div className="w-11/12 max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-center text-foreground">
                  Confirmar consulta PER/DCOMP
                </h2>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
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
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      {queryValue || '—'}
                    </code>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setPerdecompOpen(false)}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePerdecompConfirm}
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Sim, continuar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Draggable>
  );
}
