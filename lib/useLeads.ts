"use client";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((r) => r.json());

/**
 * Hook simples para carregar leads (use a mesma fonte do Kanban).
 * Ajuste a URL para seu endpoint atual (ex.: /api/clientes?filtros=...).
 */
export function useLeads(params = "") {
  const { data, error, isLoading, mutate } = useSWR(`/api/leads${params ? "?" + params : ""}`, fetcher, {
    revalidateOnFocus: false,
  });
  return {
    leads: Array.isArray(data) ? data : data?.leads || [],
    error,
    isLoading,
    mutate,
  };
}
