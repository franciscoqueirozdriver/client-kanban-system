// lib/ui/safe.ts
export function getSegmento(item: unknown): string {
  const it = item as Record<string, unknown> | null | undefined;
  const seg =
    (it?.segmento as string | undefined) ??
    (it?.organizacao_segmento as string | undefined);
  const val = typeof seg === 'string' ? seg.trim() : '';
  return val.length > 0 ? val : '—';
}

export function asArray<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}
