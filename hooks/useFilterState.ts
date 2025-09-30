'use client';
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useFilterState(def: Record<string, string[]>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL or defaults
  const getInitialState = useCallback(() => {
    const initialState: Record<string, string[]> = {};
    for (const key in def) {
      const paramValue = searchParams.get(key);
      initialState[key] = paramValue ? paramValue.split(',') : def[key] ?? [];
    }
    return initialState;
  }, [searchParams, def]);

  const [state, setState] = useState<Record<string, string[]>>(getInitialState);

  // Effect to update state if URL changes (e.g., browser back/forward)
  useEffect(() => {
    setState(getInitialState());
  }, [searchParams, getInitialState]);


  const update = useCallback((key: string, values: string[]) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (values.length > 0) {
      newParams.set(key, values.join(','));
    } else {
      newParams.delete(key);
    }

    const newUrl = `${pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
    // The state will be updated by the useEffect that listens to searchParams
  }, [searchParams, pathname, router]);

  return { state, update };
}