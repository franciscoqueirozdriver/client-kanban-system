'use client';
import { Draggable } from '@hello-pangea/dnd';
import { useState } from 'react';
import MessageModal from './MessageModal';
import ObservationModal from './ObservationModal';
import HistoryModal from './HistoryModal';

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

export default function KanbanCard({ card, index }) {
  const [client, setClient] = useState(card.client);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState([]);
  const [onSelectMessage, setOnSelectMessage] = useState(null);
  const [obsOpen, setObsOpen] = useState(false);
  const [obsAction, setObsAction] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);

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

  const handlePhoneClick = async (e, phone, contact) => {
    e.preventDefault();
    const digits = displayPhone(phone).replace(/\D/g, '');
    if (!digits) return;
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    const messages = await fetchMessages('whatsapp');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const finalMsg = encodeURIComponent(
          replacePlaceholders(mensagem, { client, contact, phone })
        );
        const url = `https://web.whatsapp.com/send/?phone=${number}&text=${finalMsg}&type=phone_number&app_absent=0`;
        openObservation(async (obs) => {
          await logInteraction({ tipo: 'WhatsApp', canal: phone, mensagemUsada: titulo, observacao: obs });
          window.open(url, '_blank');
        });
      });
    } else {
      const url = `https://web.whatsapp.com/send/?phone=${number}&type=phone_number&app_absent=0`;
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'WhatsApp', canal: phone, observacao: obs });
        window.open(url, '_blank');
      });
    }
  };

  const handleEmailClick = async (e, email, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const cleanEmail = displayEmail(email);
    const messages = await fetchMessages('email');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const subject = encodeURIComponent(
          replacePlaceholders(titulo, { client, contact, phone })
        );
        const body = encodeURIComponent(
          replacePlaceholders(mensagem, { client, contact, phone })
        );
        const url = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;
        openObservation(async (obs) => {
          await logInteraction({ tipo: 'E-mail', canal: cleanEmail, mensagemUsada: titulo, observacao: obs });
          window.location.href = url;
        });
      });
    } else {
      const url = `mailto:${cleanEmail}`;
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'E-mail', canal: cleanEmail, observacao: obs });
        window.location.href = url;
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
      if (data.duplicate) {
        alert('Empresa já cadastrada!');
        return;
      }
      if (res.ok) {
        alert('Empresa cadastrada com sucesso!');
        if (data.row) {
          setClient((prev) => ({ ...prev, sheetRow: data.row }));
        }
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

  const borderLeftColor =
    client.color === 'green'
      ? '#4caf50'
      : client.color === 'red'
      ? '#ff7043'
      : 'transparent';

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <>
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            backgroundColor,
            borderLeft: `4px solid ${borderLeftColor}`,
          }}
          className="p-2 mb-2 rounded shadow transition-colors"
          onDoubleClick={handleRegisterCompany}
        >
          <h4 className="text-sm font-semibold mb-1">{client.company}</h4>
          {client.sheetRow && (
            <p className="text-[10px] text-gray-600 mb-1">
              Linha Planilha: {client.sheetRow}
            </p>
          )}
          {(client.city || client.uf) && (
            <p className="text-[10px] text-gray-600 mb-1">
              {[client.city, client.uf].filter(Boolean).join(' - ')}
            </p>
          )}

          {client.opportunities.length > 0 && (
            <ul className="text-[10px] list-disc ml-4 mb-1">
              {client.opportunities.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}

          {client.contacts.map((c, i) => (
            <div key={i} className="text-xs border-t pt-1">
              <p className="font-medium">{c.name}</p>
              {c.role && <p className="text-[10px]">{c.role}</p>}

              {/* ✅ Suporte a múltiplos e-mails separados por ; */}
              {c.email && (
                <p className="text-[10px]">
                  {c.email.split(';').map((em, idx) => {
                    const clean = displayEmail(em.trim());
                    return (
                      <span key={idx}>
                        <button
                          type="button"
                          className="text-blue-600 underline"
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
                <p className="text-[10px]">
                  {c.normalizedPhones.map((p, idx) => (
                    <span key={idx}>
                      <a
                        href={`https://web.whatsapp.com/send/?phone=${displayPhone(p)
                          .replace(/\D/g, '')
                          .replace(/^/, (d) => (d.startsWith('55') ? d : `55${d}`))}&type=phone_number&app_absent=0`}
                        className="text-green-600 underline"
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
                <p>
                  <a
                    href={c.linkedin}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </p>
              )}
            </div>
          ))}
          <div className="mt-1">
            <button
              type="button"
              className="text-blue-600 underline text-[10px]"
              onClick={handleHistoryClick}
            >
              Histórico
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
        </>
      )}
    </Draggable>
  );
}
