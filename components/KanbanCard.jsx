'use client';
import { Draggable } from '@hello-pangea/dnd';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MessageModal from './MessageModal';
import ObservationModal from './ObservationModal';
import HistoryModal from './HistoryModal';
import { onlyDigits, isValidCNPJ } from '@/utils/cnpj';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Remove proteção visual dos números ('+553199999999' -> +553199999999)
function displayPhone(phone) {
  return String(phone || '').replace(/^'+/, '');
}

function displayEmail(email) {
  return String(email || '').replace(/^'+/, '');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'bom dia';
  if (h < 18) return 'boa tarde';
  return 'boa noite';
}

function replacePlaceholders(template, { client, contact, phone }) {
  if (!template) return '';
  let msg = template;
  const firstName = (contact?.name || contact?.nome || '').split(' ')[0];
  const map = {
    '[nome]': firstName || '',
    '[Cliente]': client?.company || '',
    '[Cargo]': contact?.role || contact?.cargo || '',
    '[Email]': contact?.email || '',
    '[Telefone]': displayPhone(phone) || '',
    '[Cidade]': client?.city || '',
    '[UF]': client?.uf || '',
    '[Segmento]': client?.segment || '',
  };
  if (msg.includes('[Saudacao]')) {
    map['[Saudacao]'] = getGreeting();
  }
  Object.entries(map).forEach(([key, value]) => {
    msg = msg.split(key).join(value || '');
  });
  return msg;
}

async function fetchMessages(app) {
  try {
    const res = await fetch(`/api/mensagens?app=${app}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.mensagens)) return data.mensagens;
    if (Array.isArray(data?.messages)) return data.messages;
    return [];
  } catch {
    return [];
  }
}

export default function KanbanCard({ card, index, onOpenSpotter }) {
  const [client, setClient] = useState(card.client);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState([]);
  const [onSelectMessage, setOnSelectMessage] = useState(null);
  const [obsOpen, setObsOpen] = useState(false);
  const [obsAction, setObsAction] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [perdecompOpen, setPerdecompOpen] = useState(false);
  const [isEnrichConfirmOpen, setIsEnrichConfirmOpen] = useState(false);
  const router = useRouter();

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

  const openModal = (messages, action) => {
    setModalMessages(messages);
    setOnSelectMessage(() => action);
    setModalOpen(true);
  };

  const openObservation = (action) => {
    setObsAction(() => action);
    setObsOpen(true);
  };

  const logInteraction = async (data) => {
    await fetch('/api/interacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: client.id, dataHora: new Date().toISOString(), ...data }),
    });
  };

  const handleHistoryClick = async () => {
    const res = await fetch(`/api/interacoes?clienteId=${client.id}`);
    const history = await res.json();
    setHistoryData(history);
    setHistoryOpen(true);
  };

  const handleEmailClick = async (event, email, contact) => {
    event.preventDefault();
    const messages = await fetchMessages('email');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const finalMsg = replacePlaceholders(mensagem, { client, contact, phone: null });
        openObservation(async (obs) => {
          await logInteraction({ tipo: 'Email', canal: email, mensagemUsada: titulo, observacao: obs });
          window.open(`mailto:${email}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(finalMsg)}`);
        });
      });
    } else {
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'Email', canal: email, observacao: obs });
        window.open(`mailto:${email}`);
      });
    }
  };

  const handlePhoneClick = async (event, phone, contact) => {
    event.preventDefault();
    const digits = onlyDigits(phone);
    const normalized = digits.length === 13 && digits.startsWith('55') ? digits : `55${digits}`;
    const messages = await fetchMessages('whatsapp');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const finalMsg = encodeURIComponent(replacePlaceholders(mensagem, { client, contact, phone }));
        openObservation(async (obs) => {
          await logInteraction({ tipo: 'WhatsApp', canal: normalized, mensagemUsada: titulo, observacao: obs });
          window.open(`https://wa.me/${normalized}?text=${finalMsg}`, '_blank');
        });
      });
    } else {
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'WhatsApp', canal: normalized, observacao: obs });
        window.open(`https://wa.me/${normalized}`, '_blank');
      });
    }
  };

  const handleLinkedinClick = async (e, url, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const messages = await fetchMessages('linkedin');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const finalMsg = encodeURIComponent(
          replacePlaceholders(mensagem, { client, contact, phone })
        );
        const finalUrl = `${url}?message=${finalMsg}`;
        openObservation(async (obs) => {
          await logInteraction({ tipo: 'LinkedIn', canal: url, mensagemUsada: titulo, observacao: obs });
          window.open(finalUrl, '_blank');
        });
      });
    } else {
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'LinkedIn', canal: url, observacao: obs });
        window.open(url, '_blank');
      });
    }
  };
  const accentMap = {
	    green: 'hsl(var(--success))',
	    red: 'hsl(var(--danger))',
	    gray: 'hsl(var(--muted-foreground))',
	    purple: 'hsl(var(--secondary))',
	  };
	
	  const handleRegisterCompany = async () => {
	    if (!window.confirm('Deseja realmente cadastrar essa empresa na planilha?')) {
	      return;
	    }
	    try {
	      const res = await fetch('/api/companies', {
	        method: 'POST',
	        headers: { 'Content-Type': 'application/json' },
	        body: JSON.stringify({ client }),
	      });
	      const data = await res.json();
	      if (res.ok) {
	        alert('Empresa cadastrada com sucesso!');
	        setClient((prev) => ({ ...prev, sheetRow: data.row }));
	      } else {
	        alert(data.error || 'Erro ao cadastrar empresa');
	      }
	    } catch (err) {
	      alert('Erro ao cadastrar empresa');
	    }
	  };
	
	  const backgroundColor =
	    client.color === 'green'
	      ? '#a3ffac'
	      : client.color === 'red'
	      ? '#ffca99'
	      : 'white';

  const accentColor = accentMap[client.color] || 'hsl(var(--primary))';

  const handleDoubleClick = () => {
    setIsEnrichConfirmOpen(true);
  };

  const handleEnrichConfirm = async () => {
    setIsEnrichConfirmOpen(false);
    setLoading(true);
    try {
      const response = await fetch(`/api/empresas/enriquecer?cnpj=${queryValue}`);
      if (!response.ok) throw new Error('Falha ao enriquecer');
      const payload = await response.json();
      setClient((prev) => ({ ...prev, ...payload }));
      await logInteraction({ tipo: 'Enriquecimento', observacao: 'Dados atualizados via PER/DCOMP' });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePerdecompConfirm = () => {
    setPerdecompOpen(false);
    const url = `/consultas/perdecomp-comparativo?q=${encodeURIComponent(queryValue)}`;
    router.push(url);
  };

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
          className={cn(
	            'relative mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-sm shadow transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
	            loading && 'pointer-events-none opacity-60',
	            snapshot.isDragging && 'ring-2 ring-primary/60 shadow-soft',
	          )}
	          onDoubleClick={handleDoubleClick}
	          title="Dê duplo clique para enriquecer os dados desta empresa"
	          tabIndex={0}
	          aria-roledescription="Cartão do kanban"
	        >
	          <span
	            aria-hidden="true"
	            className="absolute inset-y-4 left-0 w-1 rounded-full"
	            style={{ background: 'var(--card-accent)' }}
	          />
	          <h4 className="text-base font-semibold text-foreground">
	            {client.company}
	          </h4>
	          {client.sheetRow && (
	            <p className="text-[10px] text-gray-600 mb-1">
	              Linha Planilha: {client.sheetRow}
	            </p>
	          )}
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
                          .replace(/^/, (d) => (d.startsWith('55') ? d : `55${d}`))}&type=phone_number&app_absent=0`}
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
              type="button"
              data-spotter-button="true"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenSpotter?.(client, {
                  cardId: card.id,
                  onUpdate: (update) => {
                    setClient((prev) => ({ ...prev, ...update }));
                  },
                });
              }}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Enviar esta oportunidade para o Exact Spotter"
            >
              Enviar ao Spotter
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-primary">
            <button
              type="button"
              className="font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline"
              onClick={handleHistoryClick}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setPerdecompOpen(true)}
              className="font-medium underline-offset-4 hover:text-primary/80 focus-visible:underline"
              aria-label="Consultar PER/DCOMP para este cliente"
              data-testid="cta-perdecomp"
              title="Consultar PER/DCOMP"
            >
              Consultar PER/DCOMP
            </button>
          </div>
        </div>
        <MessageModal
          open={modalOpen}
          messages={modalMessages}
          onSelect={(msg) => {
            if (onSelectMessage) onSelectMessage(msg);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
        <ObservationModal
          open={obsOpen}
          onConfirm={async (obs) => {
            if (obsAction) await obsAction(obs);
            setObsOpen(false);
          }}
          onClose={() => setObsOpen(false)}
        />
        <HistoryModal
          open={historyOpen}
          interactions={historyData}
          onClose={() => setHistoryOpen(false)}
        />
        <Dialog open={isEnrichConfirmOpen} onOpenChange={setIsEnrichConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <DialogTitle>Confirmar Enriquecimento</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 text-sm text-muted-foreground">
              Deseja buscar e atualizar os dados para a empresa{' '}
              <span className="font-semibold text-foreground">{client.company}</span>?
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEnrichConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleEnrichConfirm} disabled={loading}>
                Sim, enriquecer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <Button
                type="button"
                variant="outline"
                onClick={() => setPerdecompOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handlePerdecompConfirm}>
                Sim, continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
      )}
    </Draggable>
  );
}
