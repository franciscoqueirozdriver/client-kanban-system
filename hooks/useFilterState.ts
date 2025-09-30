'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type FilterState = Record<string, string[]>;

export function useFilterState(defaults: FilterState) {
  const [state, setState] = useState<FilterState>(defaults);
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams();

  useEffect(() => {
    const init: FilterState = {};
    Object.keys(defaults).forEach((key) => {
      const raw = qs.get(key);
      init[key] = raw ? raw.split(',').filter(Boolean) : defaults[key] ?? [];
    });
    setState(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key: string, values: string[]) {
    setState((prev) => {
      const next = { ...prev, [key]: values };
      const params = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v?.length) params.set(k, v.join(','));
      });
      router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
      return next;
    });
  }

  function reset() {
    setState(defaults);
    router.replace(pathname, { scroll: false });
  }

  return { state, update, reset };
}
