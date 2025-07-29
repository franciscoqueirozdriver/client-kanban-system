'use client';

export default function MessageModal({ open, messages = [], onSelect, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded shadow-lg p-6 w-11/12 max-w-md mx-auto">
        <h2 className="text-lg font-bold mb-4 text-center">Selecione uma mensagem</h2>
        <div className="flex flex-col gap-2 mb-4">
          {messages.map((m, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (onSelect) onSelect(m.mensagem);
                if (onClose) onClose();
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
            >
              {m.titulo}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-2 px-3 py-2 bg-gray-400 text-white rounded w-full"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
