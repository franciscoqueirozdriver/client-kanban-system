'use client';
import { useState } from 'react';

export default function ObservationModal({ open, onConfirm, onClose }) {
  const [obs, setObs] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm(obs);
    setObs('');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded shadow-lg p-6 w-11/12 max-w-md mx-auto">
        <h2 className="text-lg font-bold mb-4 text-center">Observação</h2>
        <textarea
          className="w-full border p-2 mb-4"
          rows={4}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
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
