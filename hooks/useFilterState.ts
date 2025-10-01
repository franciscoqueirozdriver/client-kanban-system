'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function cloneValues<T>(value: T): T {
  return Array.isArray(value) ? ([...value] as T) : value;
}

export function useFilterState<T extends Record<string, string[]>>(defaults: T) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<T>(defaults);

  // Inicializa filtros a partir da querystring
  useEffect(() => {
    const initial = { ...defaults } as T;

    (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
      // Fallback seguro: evita erro de null no build
      const raw = searchParams?.get(String(key)) ?? null;
      initial[key] = raw
        ? (raw.split(',').filter(Boolean) as any)
        : cloneValues(defaults[key]);
    });

    setState(initial);
  }, [defaults, searchParams]);

  // Atualiza URL quando o estado mudar
  const replace = useCallback(
    (next: T) => {
      const params = new URLSearchParams();

      (Object.keys(next) as Array<keyof T>).forEach((key) => {
        const value = next[key];
        if (value && value.length > 0) {
          params.set(String(key), value.join(','));
        }
      });

      const queryString = params.toString();
      const url = `${pathname}${queryString ? `?${queryString}` : ''}`;

      router.replace(url, { scroll: false });
      setState(next);
    },
    [pathname, router]
  );

  const reset = useCallback(() => {
    setState(defaults);
    router.replace(pathname, { scroll: false });
  }, [defaults, pathname, router]);

  return { state, replace, reset };
}
