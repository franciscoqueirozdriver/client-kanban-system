'use client';
import { useState } from 'react';
import MessageModal from '@/components/MessageModal';
import ObservationModal from '@/components/ObservationModal';
import HistoryModal from '@/components/HistoryModal';

// --- Funções Helper (movidas para cá para serem reutilizadas) ---

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

// --- O Hook Customizado ---

export function useCardInteractions(client) {
  // --- State para os Modais ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState([]);
  const [onSelectMessage, setOnSelectMessage] = useState(null);
  const [obsOpen, setObsOpen] = useState(false);
  const [obsAction, setObsAction] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  // --- Lógica de Interação ---

  const logInteraction = async (data) => {
    await fetch('/api/interacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: client.id, dataHora: new Date().toISOString(), ...data }),
    });
  };

  const openModal = (messages, action) => {
    setModalMessages(messages);
    setOnSelectMessage(() => action);
    setModalOpen(true);
  };

  const openObservation = (action) => {
    setObsAction(() => action);
    setObsOpen(true);
  };

  // --- Handlers de Ação ---

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
    const action = ({ titulo, mensagem }) => {
      const finalMsg = encodeURIComponent(replacePlaceholders(mensagem, { client, contact, phone }));
      const url = `https://web.whatsapp.com/send/?phone=${number}&text=${finalMsg}&type=phone_number&app_absent=0`;
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'WhatsApp', canal: phone, mensagemUsada: titulo, observacao: obs });
        window.open(url, '_blank');
      });
    };
    if (messages.length > 0) {
      openModal(messages, action);
    } else {
      action({ titulo: '', mensagem: '' });
    }
  };

  const handleEmailClick = async (e, email, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const cleanEmail = displayEmail(email);
    const messages = await fetchMessages('email');
    const action = ({ titulo, mensagem }) => {
      const subject = encodeURIComponent(replacePlaceholders(titulo, { client, contact, phone }));
      const body = encodeURIComponent(replacePlaceholders(mensagem, { client, contact, phone }));
      const url = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'E-mail', canal: cleanEmail, mensagemUsada: titulo, observacao: obs });
        window.location.href = url;
      });
    };
    if (messages.length > 0) {
      openModal(messages, action);
    } else {
      action({ titulo: '', mensagem: '' });
    }
  };

  const handleLinkedinClick = async (e, url, contact) => {
    e.preventDefault();
    const phone = contact.mobile || contact.phone || '';
    const messages = await fetchMessages('linkedin');
    const action = ({ titulo, mensagem }) => {
      const finalMsg = encodeURIComponent(replacePlaceholders(mensagem, { client, contact, phone }));
      const finalUrl = `${url}?message=${finalMsg}`;
      openObservation(async (obs) => {
        await logInteraction({ tipo: 'LinkedIn', canal: url, mensagemUsada: titulo, observacao: obs });
        window.open(finalUrl, '_blank');
      });
    };
    if (messages.length > 0) {
      openModal(messages, action);
    } else {
      action({ titulo: '', mensagem: '' });
    }
  };

  // --- Componente para Renderizar os Modais ---

  const Modals = () => (
    <>
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
      <HistoryModal open={historyOpen} interactions={historyData} onClose={() => setHistoryOpen(false)} />
    </>
  );

  return {
    handleHistoryClick,
    handlePhoneClick,
    handleEmailClick,
    handleLinkedinClick,
    Modals,
  };
}