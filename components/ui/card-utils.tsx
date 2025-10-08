'use client';

import { FaSpinner, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from 'react-icons/fa';

export function getRiskBadgeColor(nivel: string) {
  const value = nivel.toUpperCase();
  switch (value) {
    case 'BAIXO':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'MÉDIO':
    case 'MEDIO':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'ALTO':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function normalizeRisk(risk?: string | null): 'ALTO' | 'MÉDIO' | 'BAIXO' | 'DESCONHECIDO' {
    const upper = (risk || '').toUpperCase();
    if (upper === 'MEDIO') return 'MÉDIO';
    if (upper === 'ALTO' || upper === 'MÉDIO' || upper === 'BAIXO') return upper;
    return 'DESCONHECIDO';
}

export function formatDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function describeFamilia(label: string) {
  const value = label.toUpperCase();
  switch (value) {
    case 'DCOMP':
      return 'DCOMP (Declarações de Compensação)';
    case 'REST':
      return 'REST (Pedidos de Restituição)';
    case 'RESSARC':
      return 'RESSARC (Pedidos de Ressarcimento)';
    case 'CANC':
      return 'Cancelamentos';
    case 'DESCONHECIDO':
      return 'Não classificado';
    default:
      return label;
  }
}

export function buildApiErrorLabel(e: any) {
  const parts: string[] = [];
  if (e?.httpStatus) {
    parts.push(`API error: ${e.httpStatus}${e.httpStatusText ? ' ' + e.httpStatusText : ''}`);
  } else {
    parts.push('API error:');
  }
  if (e?.message) {
    parts.push(e.message);
  }
  return parts.join(' ');
}

export function SourceBadge({ source, consultedAtISO }: { source?: 'snapshot' | 'network'; consultedAtISO?: string | null }) {
  if (!source) return null;
  const isSnapshot = source === 'snapshot';
  const label = isSnapshot ? 'Cache' : 'Atualizado';
  const color = isSnapshot
    ? 'bg-slate-100 text-slate-700 ring-slate-200'
    : 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  const dateLabel = formatDate(consultedAtISO);

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ${color}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0 opacity-80" aria-hidden="true">
        {isSnapshot ? (
          <path d="M12 3a9 9 0 1 0 9 9H12V3z" fill="currentColor" />
        ) : (
          <path d="M12 2a10 10 0 1 0 10 10h-2A8 8 0 1 1 12 4v8h8A8 8 0 0 1 12 2z" fill="currentColor" />
        )}
      </svg>
      <span className="leading-tight">
        {label}
        {dateLabel ? ` • ${dateLabel}` : ''}
      </span>
    </span>
  );
}