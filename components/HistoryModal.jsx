'use client';

export default function HistoryModal({ open, interactions = [], onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded shadow-lg p-6 w-11/12 max-w-lg mx-auto">
        <h2 className="text-lg font-bold mb-4 text-center">Histórico de Interações</h2>
        <div className="max-h-60 overflow-y-auto text-sm mb-4">
          {interactions.map((i, idx) => (
            <div key={idx} className="border-b py-1">
              <p className="font-medium">
                {new Date(i.dataHora).toLocaleString('pt-BR')} - {i.tipo}
              </p>
              {i.tipo === 'Mudança de Fase' && (
                <p className="text-xs">
                  {i.deFase} → {i.paraFase}
                </p>
              )}
              {i.observacao && (
                <p className="text-xs text-gray-700">Obs: {i.observacao}</p>
              )}
              {i.mensagemUsada && (
                <p className="text-xs text-gray-700">Mensagem: {i.mensagemUsada}</p>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="px-3 py-2 bg-gray-400 text-white rounded w-full"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
