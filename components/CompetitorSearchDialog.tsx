'use client';

import { useEffect, useState } from 'react';

export type CompetitorItem = { nome: string; cnpj: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  limitRemaining: number;
  fetchState: { loading: boolean; error?: string | null; items: CompetitorItem[] };
  onConfirm: (selected: CompetitorItem[]) => void;
}

export default function CompetitorSearchDialog({
  isOpen,
  onClose,
  clientName,
  limitRemaining,
  fetchState,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
    }
  }, [isOpen, fetchState.items]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else if (next.size < limitRemaining) {
        next.add(idx);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = Array.from(selected).map(i => fetchState.items[i]);
    onConfirm(chosen);
    setSelected(new Set());
  };

  if (!isOpen) return null;

  const countSelected = selected.size;
  const limit = limitRemaining;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex" onClick={onClose}>
      <div
        className="absolute top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 p-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Sugestões de Concorrentes para {clientName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
          >
            ✕
          </button>
        </div>

        {fetchState.loading && <p className="mb-4">Carregando...</p>}
        {fetchState.error && <p className="mb-4 text-red-500">{fetchState.error}</p>}

        {!fetchState.loading && !fetchState.error && fetchState.items.length === 0 && (
          <p className="mb-4 text-sm text-gray-500">Nenhuma sugestão disponível.</p>
        )}

        {fetchState.items.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[65vh] overflow-y-auto">
            {fetchState.items.map((it, idx) => {
              const disabled = !selected.has(idx) && selected.size >= limit;
              return (
                <li key={idx} className="py-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(idx)}
                    onChange={() => toggle(idx)}
                    disabled={disabled}
                    className="mr-2 h-4 w-4 text-violet-600 disabled:opacity-50"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{it.nome}</span>
                    <span className="text-xs font-mono text-gray-500">{it.cnpj || '(sem CNPJ)'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm">Selecionados {countSelected} de {limit}</span>
          <div className="space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={countSelected === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Adicionar selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

