'use client';

import { useEffect, useMemo, useState } from 'react';
import { digits, padCNPJ14 } from '@/utils/cnpj';

export type CompetitorItem = { nome: string; cnpj: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  limitRemaining: number;
  fetchState: { loading: boolean; error?: string | null; items: CompetitorItem[] };
  onConfirm: (selected: CompetitorItem[]) => void;
}


const sanitizeCnpj = (value: string) => {
  const cleaned = digits(value);
  if (!cleaned) return '';
  return cleaned.length > 14 ? cleaned.slice(-14) : cleaned.padStart(14, '0');
};

const keyForItem = (item: CompetitorItem, fallbackIndex?: number) => {
  const normalized = digits(item?.cnpj);
  if (normalized) return normalized;
  const nameKey = (item?.nome || '').trim().toLowerCase();
  if (nameKey) return nameKey;
  return fallbackIndex !== undefined ? `idx-${fallbackIndex}` : 'idx-unknown';
};

export default function CompetitorSearchDialog({
  isOpen,
  onClose,
  clientName,
  limitRemaining,
  fetchState,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Record<string, CompetitorItem>>({});

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  useEffect(() => {
    if (isOpen) {
      setSelected({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const allowed = new Set(fetchState.items.map((item, index) => keyForItem(item, index)));
    setSelected(prev => {
      let mutated = false;
      const next: Record<string, CompetitorItem> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (allowed.has(key)) {
          next[key] = value;
        } else {
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [fetchState.items, isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const toggle = (item: CompetitorItem, index: number) => {
    setSelected(prev => {
      const key = keyForItem(item, index);
      if (prev[key]) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      const currentCount = Object.keys(prev).length;
      if (currentCount >= limitRemaining) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          nome: item.nome,
          cnpj: sanitizeCnpj(item.cnpj),
        },
      };
    });
  };

  const handleConfirm = () => {
    const chosen = fetchState.items.reduce<CompetitorItem[]>((acc, item, index) => {
      const key = keyForItem(item, index);
      const stored = selected[key];
      if (stored) {
        acc.push(stored);
      }
      return acc;
    }, []);

    if (chosen.length === 0) {
      return;
    }

    onConfirm(chosen);
    setSelected({});
  };

  if (!isOpen) return null;

  const countSelected = selectedCount;
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
              const key = keyForItem(it, idx);
              const isChecked = Boolean(selected[key]);
              const disabled = !isChecked && selectedCount >= limit;
              return (
                <li key={key} className="py-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(it, idx)}
                    disabled={disabled}
                    className="mr-2 h-4 w-4 text-violet-600 disabled:opacity-50"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{it.nome}</span>
                    <span className="text-xs font-mono text-gray-500">{it.cnpj ? padCNPJ14(it.cnpj) : '(sem CNPJ)'}</span>
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
