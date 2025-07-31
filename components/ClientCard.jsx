'use client';
import { useState } from 'react';
import MessageModal from './MessageModal';

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
  // Suporta placeholder de saudação existente
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

export default function ClientCard({ client, onStatusChange }) {
  const [color, setColor] = useState(client.color || '');
  const [status, setStatus] = useState(client.status || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState([]);
  const [onSelectMessage, setOnSelectMessage] = useState(null);

  const handleDoubleClick = async () => {
    const newColor = 'green';
    const newStatus = 'Lead Selecionado';
    setColor(newColor);
    setStatus(newStatus);

  if (onStatusChange) {
      onStatusChange(client.id, newStatus, newColor);
    }

    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: client.id,
        status: newStatus,
        color: newColor,
      }),
    });
  };

  const openModal = (messages, action) => {
    setModalMessages(messages);
    setOnSelectMessage(() => action);
    setModalOpen(true);
  };

  const handlePhoneClick = async (e, phone, contact) => {
    e.preventDefault();
    const digits = displayPhone(phone).replace(/\D/g, '');
    if (!digits) return;
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    const messages = await fetchMessages('whatsapp');
    if (messages.length > 0) {
      openModal(messages, ({ mensagem }) => {
        const finalMsg = replacePlaceholders(mensagem, { client, contact, phone });
        const encoded = encodeURIComponent(finalMsg);
        const url = `https://web.whatsapp.com/send/?phone=${number}&text=${encoded}&type=phone_number&app_absent=0`;
        window.open(url, '_blank');
      });
    } else {
      const url = `https://web.whatsapp.com/send/?phone=${number}&type=phone_number&app_absent=0`;
      window.open(url, '_blank');
    }
  };

  const handleEmailClick = async (e, email, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const cleanEmail = displayEmail(email);
    const messages = await fetchMessages('email');
    if (messages.length > 0) {
      openModal(messages, ({ titulo, mensagem }) => {
        const subject = encodeURIComponent(replacePlaceholders(titulo, { client, contact, phone }));
        const body = encodeURIComponent(replacePlaceholders(mensagem, { client, contact, phone }));
        window.location.href = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;
      });
    } else {
      window.location.href = `mailto:${cleanEmail}`;
    }
  };

  const handleLinkedinClick = async (e, url, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const messages = await fetchMessages('linkedin');
    if (messages.length > 0) {
      openModal(messages, ({ mensagem }) => {
        const finalMsg = encodeURIComponent(
          replacePlaceholders(mensagem, { client, contact, phone })
        );
        const finalUrl = `${url}?message=${finalMsg}`;
        window.open(finalUrl, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
  };

  const backgroundColor =
    color === 'green'
      ? '#a3ffac'
      : color === 'red'
      ? '#ffca99'
      : 'white';

  const borderLeftColor =
    color === 'green'
      ? '#4caf50'
      : color === 'red'
      ? '#ff7043'
      : 'transparent';

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        backgroundColor,
        borderLeft: `6px solid ${borderLeftColor}`,
      }}
      className="p-4 border rounded shadow hover:shadow-lg cursor-pointer transition-colors"
    >
      <h3 className="text-lg font-semibold mb-1">{client.company}</h3>
      {(client.city || client.uf) && (
        <p className="text-xs text-gray-600">
          {[client.city, client.uf].filter(Boolean).join(' - ')}
        </p>
      )}
      {client.opportunities.length > 0 && (
        <ul className="text-xs list-disc ml-4 my-2">
          {client.opportunities.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {client.contacts.map((c, idx) => (
          <div key={idx} className="text-sm border-t pt-1">
            <p className="font-medium">{c.name}</p>
            <p className="text-xs">{c.role}</p>

            {/* ✅ Múltiplos e-mails separados por ; */}
            {c.email && (
              <p className="text-xs">
                {c.email.split(';').map((em, i) => {
                  const clean = displayEmail(em.trim());
                  return (
                    <span key={i}>
                      <button
                        type="button"
                        className="text-blue-600 underline"
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
              <p className="text-xs">
                {c.normalizedPhones.map((p, i) => (
                  <span key={i}>
                    <a
                      href={getWhatsAppLink(p)}
                      className="text-green-600 underline"
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
              <p>
                <a
                  href={c.linkedin}
                  className="text-blue-600 underline"
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
      <MessageModal
        open={modalOpen}
        messages={modalMessages}
        onSelect={(msg) => {
          if (onSelectMessage) onSelectMessage(msg);
          setModalOpen(false);
        }}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
