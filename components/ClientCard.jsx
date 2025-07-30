'use client';
import { useState } from 'react';
import MessageModal from './MessageModal';

function getWhatsAppLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
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
  const firstName = (contact?.name || '').split(' ')[0]; // ✅ Apenas primeiro nome
  const map = {
    '[Cliente]': client?.company || '',
    '[Contato]': firstName || '',
    '[Cargo]': contact?.role || '',
    '[Email]': contact?.email || '',
    '[Telefone]': phone || '',
    '[Cidade]': client?.city || '',
    '[UF]': client?.uf || '',
    '[Segmento]': client?.segment || '',
    '[Saudacao]': getGreeting(),
  };
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

    // ✅ Atualiza na planilha usando Cliente_ID
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: client.id, // Cliente_ID
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
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return;
    const messages = await fetchMessages('whatsapp');
    if (messages.length > 0) {
      openModal(messages, (msg) => {
        const finalMsg = replacePlaceholders(msg, { client, contact, phone });
        const encoded = encodeURIComponent(finalMsg);
        const url = digits.startsWith('55')
          ? `https://wa.me/${digits}?text=${encoded}`
          : `https://wa.me/55${digits}?text=${encoded}`;
        window.open(url, '_blank');
      });
    } else {
      const url = digits.startsWith('55')
        ? `https://wa.me/${digits}`
        : `https://wa.me/55${digits}`;
      window.open(url, '_blank');
    }
  };

  const handleEmailClick = async (e, email, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const messages = await fetchMessages('email');
    if (messages.length > 0) {
      openModal(messages, (msg) => {
        const finalMsg = replacePlaceholders(msg, { client, contact, phone });
        const encoded = encodeURIComponent(finalMsg);
        window.location.href = `mailto:${email}?subject=&body=${encoded}`;
      });
    } else {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        backgroundColor:
          color === 'green'
            ? '#8BC34A'
            : color === 'red'
              ? '#E57373'
              : 'white',
      }}
      className="p-4 border rounded shadow hover:shadow-lg cursor-pointer"
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
            <p className="text-xs">
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={(e) => handleEmailClick(e, c.email, c)}
              >
                {c.email}
              </button>
            </p>
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
                      {p}
                    </a>
                    {i < c.normalizedPhones.length - 1 ? ' / ' : ''}
                  </span>
                ))}
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
