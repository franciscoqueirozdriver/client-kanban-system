'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Lê um parâmetro da URL de forma segura e estável em client components.
 * Retorna sempre string (com fallback), evitando nullability.
 */
export function useQueryParam(name: string, fallback = ''): string {
  const searchParams = useSearchParams();

  // Optional chaining + fallback evita "possibly null"
  return useMemo(() => searchParams?.get(name) ?? fallback, [searchParams, name, fallback]);
}

/**
 * (Opcional) Lê múltiplos valores do mesmo param (?foo=a&foo=b)
 * Retorna sempre string[], evitando undefined/null.
 */
export function useQueryParams(name: string): string[] {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const all = searchParams?.getAll(name) ?? [];
    // Garante array novo (evita referências internas)
    return Array.isArray(all) ? [...all] : [];
  }, [searchParams, name]);
}
