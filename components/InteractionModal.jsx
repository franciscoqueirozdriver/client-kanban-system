'use client';
import { useState } from 'react';

export default function InteractionModal({ open, onConfirm, onClose }) {
  const [mensagem, setMensagem] = useState('');
  const [observacao, setObservacao] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm({ mensagem, observacao });
    setMensagem('');
    setObservacao('');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded shadow-lg p-6 w-11/12 max-w-md mx-auto">
        <h2 className="text-lg font-bold mb-4 text-center">Registrar Mudança</h2>
        <textarea
          className="w-full border p-2 mb-2"
          rows={3}
          placeholder="Mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
        />
        <textarea
          className="w-full border p-2 mb-4"
          rows={3}
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded w-full mb-2"
          onClick={() => {
            handleConfirm();
            if (onClose) onClose();
          }}
        >
          Confirmar
        </button>
        <button
          className="px-3 py-2 bg-gray-400 text-white rounded w-full"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
