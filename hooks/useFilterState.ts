'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function arraysEqual(left: string[], right: string[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function cloneValues(values: string[] = []) {
  return [...values];
}

function shouldSyncRouter(router: ReturnType<typeof useRouter>) {
  return typeof window !== 'undefined' && typeof router.replace === 'function';
}

export type FilterState = Record<string, string[]>;

export function useFilterState<T extends Record<string, string[]>>(defaults: T) {
  const [state, setState] = useState<T>(defaults);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const initial = { ...defaults } as T;
    (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
      const raw = searchParams.get(String(key));
      initial[key] = raw ? raw.split(',').filter(Boolean) : cloneValues(defaults[key]);
    });
    setState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncUrl(next: T) {
    if (!shouldSyncRouter(router) || !pathname) {
      return;
    }

    const params = new URLSearchParams();
    (Object.entries(next) as Array<[keyof T, string[]]>).forEach(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        params.set(String(key), values.join(','));
      }
    });

    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }

  function update(key: keyof T, values: string[]) {
    setState((previous) => {
      const current = previous[key] ?? [];
      const nextValues = cloneValues(values);
      if (arraysEqual(current, nextValues)) {
        return previous;
      }

      const next = { ...previous, [key]: nextValues } as T;
      syncUrl(next);
      return next;
    });
  }

  function replace(nextState: T) {
    setState((previous) => {
      let changed = false;
      const merged = { ...previous } as T;

      (Object.keys({ ...previous, ...nextState }) as Array<keyof T>).forEach((key) => {
        const incoming = cloneValues(nextState[key] ?? []);
        const current = merged[key] ?? [];
        if (!arraysEqual(current, incoming)) {
          changed = true;
        }
        merged[key] = incoming as T[keyof T];
      });

      if (!changed) {
        return previous;
      }

      syncUrl(merged);
      return merged;
    });
  }

  function reset() {
    const cleared = { ...defaults } as T;
    (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
      cleared[key] = cloneValues(defaults[key]);
    });
    setState(cleared);

    if (shouldSyncRouter(router) && pathname) {
      router.replace(pathname, { scroll: false });
    }
  }

  return { state, update, replace, reset };
}
