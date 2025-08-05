'use client';
import { useEffect, useState } from 'react';

export default function ModalWhatsApp({ open, onClose, clienteId, numero }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (open) {
      fetch(`/api/whatsapp/historico?clienteId=${clienteId}`)
        .then((res) => res.json())
        .then((data) => setMensagens(Array.isArray(data) ? data : []))
        .catch(() => setMensagens([]));
    }
  }, [open, clienteId]);

  const handleSend = async () => {
    if (!texto.trim()) return;
    try {
      await fetch('http://localhost:3000/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Cliente_ID: clienteId,
          Numero: numero,
          Mensagem: texto,
        }),
      });
      const nova = {
        Cliente_ID: clienteId,
        Numero: numero,
        Mensagem: texto,
        Direcao: 'enviada',
        Data_Hora: new Date().toISOString(),
      };
      setMensagens((prev) => [...prev, nova]);
      setTexto('');
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white w-full max-w-md p-4 rounded shadow-lg flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 space-y-2">
          {mensagens.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.Direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`px-3 py-2 rounded-md max-w-xs text-sm ${{
                  enviada: 'bg-green-200',
                  recebida: 'bg-gray-200',
                }[m.Direcao] || 'bg-gray-200'}`}
              >
                <p>{m.Mensagem}</p>
                {m.Data_Hora && (
                  <p className="text-[10px] text-gray-500">
                    {new Date(m.Data_Hora).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Digite uma mensagem"
          />
          <button
            type="button"
            onClick={handleSend}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            Enviar
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-sm text-gray-600 self-end"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
