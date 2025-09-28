'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizeCnpj as canonicalNormalizeCnpj } from '@/lib/normalizers';

const formatCnpj = (v: string): string => {
    try {
        return canonicalNormalizeCnpj(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } catch {
        return v; // Return original on formatting error
    }
};

export type CompetitorItem = { nome: string; cnpj: string };

type Suggestion = CompetitorItem & { key: string };

type FetchState = {
  loading: boolean;
  error: string | null;
  items: CompetitorItem[];
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  limitRemaining: number;
  blockedCnpjs: string[];
  fetchState: FetchState;
  onSearch: (term: string) => Promise<CompetitorItem[]>;
  onConfirm: (selected: CompetitorItem[]) => void;
}

const digits = (value: string) => (value || '').replace(/\D+/g, '');

export default function CompetitorSearchDialog({
  isOpen,
  onClose,
  clientName,
  limitRemaining,
  blockedCnpjs,
  fetchState,
  onSearch,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Record<string, Suggestion>>({});
  const [baseItems, setBaseItems] = useState<Suggestion[]>([]);
  const [searchItems, setSearchItems] = useState<Suggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const blockedSet = useMemo(() => {
    const set = new Set<string>();
    blockedCnpjs
      .map(value => canonicalNormalizeCnpj(value))
      .filter((value): value is string => Boolean(value))
      .forEach(value => set.add(value));
    return set;
  }, [blockedCnpjs]);

  const mapToSuggestions = useCallback(
    (list: CompetitorItem[]) => {
      const suggestions: Suggestion[] = [];
      const seenCnpjs = new Set<string>();
      const seenNames = new Set<string>();

      list.forEach((item, index) => {
        const nome = String(item?.nome ?? '').trim();
        if (!nome) return;

        const cnpj = digits(String(item?.cnpj ?? ''));
        if (cnpj && blockedSet.has(cnpj)) return;

        if (cnpj) {
          if (seenCnpjs.has(cnpj)) return;
          seenCnpjs.add(cnpj);
          suggestions.push({ key: cnpj, nome, cnpj });
          return;
        }

        const lower = nome.toLowerCase();
        if (seenNames.has(lower)) return;
        seenNames.add(lower);
        suggestions.push({ key: `name:${lower || index}`, nome, cnpj: '' });
      });

      return suggestions;
    },
    [blockedSet],
  );

  useEffect(() => {
    if (!isOpen) return;
    const mapped = mapToSuggestions(fetchState.items || []);
    setBaseItems(mapped);
  }, [fetchState.items, isOpen, mapToSuggestions]);

  useEffect(() => {
    if (!isOpen) {
      setSelected({});
      setSearchTerm('');
      setSearchItems([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchItems([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    const timeout = setTimeout(() => {
      onSearch(trimmed)
        .then(results => {
          if (cancelled) return;
          setSearchItems(mapToSuggestions(results));
          setSearchLoading(false);
        })
        .catch(error => {
          if (cancelled) return;
          setSearchItems([]);
          setSearchError(error?.message || 'Falha ao buscar concorrentes.');
          setSearchLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchTerm, isOpen, onSearch, mapToSuggestions]);

  const trimmedSearch = searchTerm.trim();
  const displayItems = trimmedSearch ? searchItems : baseItems;
  const loading = trimmedSearch ? searchLoading : fetchState.loading;
  const error = trimmedSearch ? searchError : fetchState.error;

  useEffect(() => {
    if (!isOpen) return;
    const allowed = new Set(displayItems.map(item => item.key));
    setSelected(prev => {
      let mutated = false;
      const next: Record<string, Suggestion> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (allowed.has(key)) {
          next[key] = value;
        } else {
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [displayItems, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (blockedSet.size === 0) return;
    setSelected(prev => {
      let mutated = false;
      const next: Record<string, Suggestion> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const norm = canonicalNormalizeCnpj(value.cnpj);
        if (norm && blockedSet.has(norm)) {
          mutated = true;
        } else {
          next[key] = value;
        }
      });
      return mutated ? next : prev;
    });
  }, [blockedSet, isOpen]);

  const toggle = (item: Suggestion) => {
    setSelected(prev => {
      const key = item.key;
      if (!key) return prev;

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
        [key]: item,
      };
    });
  };

  const handleConfirm = useCallback(() => {
    const chosen = Object.values(selected).map(item => ({
      nome: item.nome,
      cnpj: digits(item.cnpj),
    }));

    if (chosen.length === 0) {
      return;
    }

    onConfirm(chosen);
    setSelected({});
    setSearchTerm('');
    setSearchItems([]);
    setSearchError(null);
    onClose();
  }, [selected, onConfirm, onClose]);

  const countSelected = Object.keys(selected).length;
  const limit = limitRemaining;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" aria-labelledby="competitor-dialog-title">
        <DialogHeader>
          <DialogTitle id="competitor-dialog-title">Sugestões de Concorrentes</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Baseado em {clientName ? clientName : 'empresa selecionada'}.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="competitor-search">
              Busca rápida
            </label>
            <input
              id="competitor-search"
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Digite um nome de empresa"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-background/40">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground" aria-live="polite">
                <FaSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando sugestões...
              </div>
            )}

            {!loading && error && (
              <div className="px-4 py-6 text-sm text-destructive" aria-live="polite">
                {error}
              </div>
            )}

            {!loading && !error && displayItems.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground" aria-live="polite">
                Nenhuma sugestão encontrada.
              </div>
            )}

            {!loading && !error && displayItems.length > 0 && (
              <ul className="divide-y divide-border/60">
                {displayItems.map((item, index) => {
                  const key = item.key || `item-${index}`;
                  const isChecked = Boolean(selected[key]);
                  const disabled = !isChecked && countSelected >= limit;
                  return (
                    <li key={key} className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle({ ...item, key })}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{item.nome}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.cnpj ? formatCnpj(item.cnpj) : 'CNPJ indisponível'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">Selecionados {countSelected} de {limit}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={countSelected === 0}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Adicionar selecionados
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
