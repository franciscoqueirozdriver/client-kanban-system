'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export function useQueryParam(name: string, fallback = ''): string {
  const searchParams = useSearchParams();

  return useMemo(() => searchParams.get(name) ?? fallback, [searchParams, name, fallback]);
}
