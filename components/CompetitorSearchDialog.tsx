'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { ensureValidCnpj, formatCnpj, normalizeCnpj, onlyDigits } from '@/utils/cnpj';

export type CompetitorItem = { nome: string; cnpj: string };

type Suggestion = CompetitorItem & { key: string; id?: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientCnpj?: string;
  limitRemaining: number;
  blockedCnpjs: string[];
  onConfirm: (selected: CompetitorItem[]) => void;
}

const MAX_LIMIT = 50;

const buildKey = (suggestion: Suggestion, fallbackSuffix: number) => {
  if (suggestion.cnpj) return suggestion.cnpj;
  if (suggestion.id) return `id:${suggestion.id}`;
  return `${suggestion.key}-${fallbackSuffix}`;
};

export default function CompetitorSearchDialog({
  isOpen,
  onClose,
  clientName,
  clientCnpj,
  limitRemaining,
  blockedCnpjs,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Record<string, Suggestion>>({});
  const [items, setItems] = useState<Suggestion[]>([]);
  const [baseItems, setBaseItems] = useState<Suggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blockedSet = useMemo(() => {
    const cleaned = blockedCnpjs
      .map(value => normalizeCnpj(value))
      .filter((value): value is string => Boolean(value));
    return new Set(cleaned);
  }, [blockedCnpjs]);

  const baseQuery = useMemo(() => {
    const name = (clientName || '').trim();
    const raw = onlyDigits(clientCnpj || '');
    return {
      name,
      cnpj: raw.length === 14 ? raw : undefined,
      limit: MAX_LIMIT,
    };
  }, [clientName, clientCnpj]);

  const mapSuggestions = useCallback(
    (rawItems: any[]): Suggestion[] => {
      const deduped: Suggestion[] = [];
      const seenCnpjs = new Set<string>();
      const seenFallback = new Set<string>();

      rawItems.forEach((raw, index) => {
        const nome = String(raw?.nome ?? raw?.name ?? '').trim();
        if (!nome) return;

        const normalizedCnpj = onlyDigits(raw?.cnpj ?? raw?.documento ?? raw?.cnpj_numero ?? '');
        const cnpj = normalizedCnpj.slice(0, 14);
        if (cnpj && blockedSet.has(cnpj)) return;

        const suggestion: Suggestion = {
          key: cnpj || (raw?.id ? String(raw.id) : `${nome}-${index}`),
          nome,
          cnpj,
          id: raw?.id ? String(raw.id) : undefined,
        };

        if (cnpj) {
          if (seenCnpjs.has(cnpj)) return;
          seenCnpjs.add(cnpj);
          suggestion.key = cnpj;
          deduped.push(suggestion);
          return;
        }

        let fallbackKey = suggestion.key;
        while (seenFallback.has(fallbackKey) || seenCnpjs.has(fallbackKey)) {
          fallbackKey = `${suggestion.key}-${seenFallback.size + 1}`;
        }
        seenFallback.add(fallbackKey);
        suggestion.key = fallbackKey;
        deduped.push(suggestion);
      });

      return deduped;
    },
    [blockedSet],
  );

  const fetchSuggestions = useCallback(
    async (name: string, { signal, setAsBase = false }: { signal?: AbortSignal; setAsBase?: boolean } = {}) => {
      const trimmed = (name || '').trim();
      if (!trimmed) {
        if (setAsBase) {
          setBaseItems([]);
        }
        setItems([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload: Record<string, any> = {
          name: trimmed,
          limit: baseQuery.limit,
        };
        if (baseQuery.cnpj) payload.cnpj = baseQuery.cnpj;

        const response = await fetch('/api/concorrentes/sugestoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json().catch(() => ({}));
        const list = Array.isArray(json?.items) ? json.items : [];
        const mapped = mapSuggestions(list);

        if (setAsBase) {
          setBaseItems(mapped);
        }
        setItems(mapped);
        setError(null);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[competitors] fetch suggestions', err);
        setItems([]);
        setError('Falha ao buscar concorrentes.');
      } finally {
        setLoading(false);
      }
    },
    [baseQuery.cnpj, baseQuery.limit, mapSuggestions],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelected({});
    setSearchTerm('');
    const controller = new AbortController();
    fetchSuggestions(baseQuery.name, { signal: controller.signal, setAsBase: true });
    return () => controller.abort();
  }, [isOpen, baseQuery.name, fetchSuggestions]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setItems(baseItems);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetchSuggestions(trimmed, { signal: controller.signal });
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [searchTerm, isOpen, baseItems, fetchSuggestions]);

  useEffect(() => {
    if (!isOpen) return;
    const allowed = new Set(items.map(item => item.key));
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
  }, [items, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (blockedSet.size === 0) return;
    setSelected(prev => {
      let mutated = false;
      const next: Record<string, Suggestion> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const norm = normalizeCnpj(value.cnpj);
        if (norm && blockedSet.has(norm)) {
          mutated = true;
        } else {
          next[key] = value;
        }
      });
      return mutated ? next : prev;
    });
  }, [blockedSet, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setItems([]);
      setBaseItems([]);
      setSearchTerm('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

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
    try {
      const chosen = Object.values(selected).map(it => ({
        nome: it.nome,
        cnpj: ensureValidCnpj(it.cnpj),
      }));

      if (chosen.length === 0) {
        return;
      }

      onConfirm(chosen);
      setSelected({});
      onClose();
    } catch (error: any) {
      alert(error?.message || 'CNPJ inválido');
    }
  }, [onConfirm, selected, onClose]);

  if (!isOpen) return null;

  const countSelected = Object.keys(selected).length;
  const limit = limitRemaining;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-hidden rounded-l-3xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sugestões de Concorrentes</h2>
            <p className="text-sm text-muted-foreground">Baseado em {clientName || 'empresa selecionada'}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
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

        <div className="flex-1 overflow-hidden px-6">
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

            {!loading && !error && items.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground" aria-live="polite">
                Nenhuma sugestão encontrada.
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <ul className="divide-y divide-border/60">
                {items.map((item, index) => {
                  const key = item.key || buildKey(item, index);
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

        <div className="mt-4 flex items-center justify-between border-t border-border/60 bg-card px-6 py-4">
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
        </div>
      </div>
    </div>
  );
}
