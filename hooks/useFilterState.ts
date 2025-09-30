'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type FilterDictionary = Record<string, string[]>;

function cloneValues(values: string[] | undefined) {
  return Array.isArray(values) ? [...values] : [];
}

const noopReplace = () => {};

const fallbackRouter = {
  replace: noopReplace,
} as unknown as ReturnType<typeof useRouter>;

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return fallbackRouter;
  }
}

function useSafePathname() {
  try {
    const value = usePathname();
    return typeof value === 'string' ? value : '';
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '';
  }
}

function useSafeSearchParams() {
  try {
    const params = useSearchParams();
    if (!params) {
      return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    }
    return params;
  } catch {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }
}

export function useFilterState(defaultValues: FilterDictionary) {
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const searchParams = useSafeSearchParams();
  const canSyncWithRouter = useMemo(
    () => typeof router?.replace === 'function' && router.replace !== noopReplace,
    [router],
  );

  const normalizedDefaults = useMemo(() => {
    const base: FilterDictionary = {};
    Object.entries(defaultValues).forEach(([key, value]) => {
      base[key] = cloneValues(value);
    });
    return base;
  }, [JSON.stringify(defaultValues)]);

  const keys = useMemo(() => Object.keys(normalizedDefaults), [normalizedDefaults]);

  const searchKey = useMemo(() => {
    if (typeof searchParams === 'string') {
      return searchParams.startsWith('?') ? searchParams.slice(1) : searchParams;
    }
    if (searchParams && typeof (searchParams as URLSearchParams).toString === 'function') {
      const value = (searchParams as URLSearchParams).toString();
      if (typeof value === 'string') {
        return value.startsWith('?') ? value.slice(1) : value;
      }
    }
    if (typeof window !== 'undefined') {
      const raw = window.location.search;
      return raw.startsWith('?') ? raw.slice(1) : raw;
    }
    return '';
  }, [searchParams]);

  const buildStateFromSearchString = useCallback(
    (searchString: string): FilterDictionary => {
      const sanitized = searchString.startsWith('?') ? searchString.slice(1) : searchString;
      const params = new URLSearchParams(sanitized);
      const result: FilterDictionary = {};
      keys.forEach((key) => {
        const raw = params.get(key);
        if (raw && raw.trim().length > 0) {
          result[key] = raw.split(',').filter(Boolean);
        } else {
          result[key] = cloneValues(normalizedDefaults[key]);
        }
      });
      return result;
    },
    [keys, normalizedDefaults],
  );

  const [state, setState] = useState<FilterDictionary>(() => {
    return buildStateFromSearchString(searchKey);
  });

  useEffect(() => {
    setState((previous) => {
      const next: FilterDictionary = {};
      keys.forEach((key) => {
        next[key] = previous[key] ?? cloneValues(normalizedDefaults[key]);
      });
      return next;
    });
  }, [keys, normalizedDefaults]);

  useEffect(() => {
    if (!canSyncWithRouter) {
      return;
    }
    setState((previous) => {
      const next = buildStateFromSearchString(searchKey);
      const hasChanged = keys.some((key) => {
        const current = previous[key] ?? [];
        const incoming = next[key] ?? [];
        if (current.length !== incoming.length) return true;
        return current.some((value, index) => value !== incoming[index]);
      });
      return hasChanged ? next : previous;
    });
  }, [buildStateFromSearchString, canSyncWithRouter, keys, searchKey]);

  const syncUrl = useCallback(
    (nextState: FilterDictionary) => {
      if (!canSyncWithRouter) {
        return;
      }
      const params = new URLSearchParams();
      keys.forEach((key) => {
        const values = (nextState[key] ?? []).filter(Boolean);
        if (values.length > 0) {
          params.set(key, values.join(','));
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [canSyncWithRouter, keys, pathname, router],
  );

  const update = useCallback(
    (key: string, values: string[]) => {
      setState((previous) => {
        const next: FilterDictionary = { ...previous, [key]: cloneValues(values) };
        syncUrl(next);
        return next;
      });
    },
    [syncUrl],
  );

  const reset = useCallback(() => {
    setState(() => {
      const next: FilterDictionary = {};
      keys.forEach((key) => {
        next[key] = cloneValues(normalizedDefaults[key]);
      });
      syncUrl(next);
      return next;
    });
  }, [keys, normalizedDefaults, syncUrl]);

  return { state, update, reset } as const;
}
