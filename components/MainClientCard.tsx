'use client';

import { useMemo } from 'react';
import { FaSpinner, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from 'react-icons/fa';
import type { CardPayload, CountBlock, IdentifiedCode, SnapshotMetadata } from '@/types/perdecomp-card';
import { formatCnpj } from '@/utils/cnpj';
import { getNaturezaDescription } from '@/utils/naturezas';
import DoughnutChart from './DoughnutChart';

// These interfaces can be moved to a shared types file later
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

interface CardData {
  card: CardPayload | null;
  metadata?: SnapshotMetadata | null;
  source?: 'snapshot' | 'network';
  consultedAtISO?: string | null;
  quantity?: number;
  lastConsultation?: string | null;
  siteReceipt?: string | null;
  fromCache?: boolean;
  perdcompResumo?: {
    total: number;
    totalSemCancelamento: number;
    canc: number;
    porFamilia: { DCOMP: number; REST: number; RESSARC: number; CANC: number; DESCONHECIDO: number };
    porNaturezaAgrupada: Record<string, number>;
  } | null;
  perdcompCodigos?: string[];
}

interface MainClientCardProps {
  company: Company;
  data: CardData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: any;
}

// Helper functions also present in PerdcompEnrichedCard.tsx
function buildApiErrorLabel(e: any) {
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

function getRiskBadgeColor(nivel: string) {
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

function formatDate(iso?: string | null) {
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

function SourceBadge({ source, consultedAtISO }: { source?: 'snapshot' | 'network'; consultedAtISO?: string | null }) {
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

function describeFamilia(label: string) {
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

export default function MainClientCard({
  company,
  data,
  status,
  error,
}: MainClientCardProps) {
  const card = data?.card ?? null;
  const metadata = data?.metadata ?? null;

  const naturezas = (card?.por_natureza && card.por_natureza.length > 0
    ? card.por_natureza
    : metadata?.porNatureza) ?? [];
  const creditos = (card?.por_credito && card.por_credito.length > 0
    ? card.por_credito
    : metadata?.porCredito) ?? [];
  const codigosIdentificados = card?.codigos_identificados ?? [];
  const recomendacoes = card?.recomendacoes ?? [];
  const riskNivel = (card?.analise_risco?.nivel ?? metadata?.riscoNivel ?? '').toUpperCase();
  const riskTags = card?.analise_risco?.tags ?? metadata?.tagsRisco ?? [];
  const quantosSao = useMemo(() => {
    if (card?.quantos_sao && card.quantos_sao.length > 0) {
      return card.quantos_sao;
    }
    return [] as CountBlock[];
  }, [card?.quantos_sao]);

  const codigosSummary = useMemo(() => {
    if (!codigosIdentificados || codigosIdentificados.length === 0) {
      return [];
    }
    const summary = codigosIdentificados.reduce((acc, codigo) => {
      const tipo = codigo.credito_tipo || 'Não identificado';
      const risco = codigo.risco || 'DESCONHECIDO';

      if (!acc[tipo]) {
        acc[tipo] = { total: 0 };
      }

      acc[tipo].total += 1;
      acc[tipo][risco] = (acc[tipo][risco] || 0) + 1;

      return acc;
    }, {} as Record<string, { total: number; [risk: string]: number }>);

    return Object.entries(summary)
      .map(([label, { total, ...risks }]) => ({
        label,
        total,
        risks: Object.entries(risks)
          .filter(([key]) => key !== 'total')
          .map(([riskLabel, riskCount]) => ({ label: riskLabel, count: riskCount }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
  }, [codigosIdentificados]);

  const consultedAt = data?.consultedAtISO ?? card?.rendered_at_iso ?? card?.header?.ultima_consulta_iso ?? data?.lastConsultation ?? null;
  const isCached = data?.source === 'snapshot' || data?.fromCache;

  const naturezaChartData = useMemo(() => {
    if (!naturezas || naturezas.length === 0) return null;
    return {
      labels: naturezas.map(n => getNaturezaDescription(n.label)),
      datasets: [
        {
          data: naturezas.map(n => n.count),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
          hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        },
      ],
    };
  }, [naturezas]);

  const creditoChartData = useMemo(() => {
    if (!creditos || creditos.length === 0) return null;
    return {
      labels: creditos.map(c => c.label),
      datasets: [
        {
          data: creditos.map(c => c.count),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
          hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        },
      ],
    };
  }, [creditos]);

  return (
    <article className="group relative mx-auto flex h-full w-full flex-col rounded-3xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground" title={company.Nome_da_Empresa}>
            {company.Nome_da_Empresa}
          </h3>
          <p className="text-sm text-muted-foreground">{formatCnpj(company.CNPJ_Empresa)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <SourceBadge source={data?.source ?? (isCached ? 'snapshot' : undefined)} consultedAtISO={consultedAt} />
        </div>
      </header>

      <div className="flex-1">
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center text-primary">
            <FaSpinner className="h-8 w-8 animate-spin" aria-hidden="true" />
          </div>
        )}

        {status === 'error' && (
          <div className="flex h-full items-center justify-center text-center text-destructive">
            {buildApiErrorLabel(error)}
          </div>
        )}

        {status === 'loaded' && data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Coluna 1 */}
            <div className="space-y-4">
                {riskNivel && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Análise de risco
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getRiskBadgeColor(riskNivel)}`}>
                                {riskNivel}
                            </span>
                        </div>
                        {riskTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {riskTags.map(tag => (
                                    <span key={tag.label} className="inline-flex items-center rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
                                        {tag.label} • {tag.count}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {quantosSao.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantos são:</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {quantosSao.map(block => (
                                <li key={block.label} className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">{describeFamilia(block.label)}</span>
                                    <span className="font-medium">{block.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {naturezas.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por natureza:</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {naturezas.map((block: CountBlock) => (
                                <li key={block.label} className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">{getNaturezaDescription(block.label)}</span>
                                    <span className="font-medium">{block.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {creditos.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por crédito:</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {creditos.map((block: CountBlock) => (
                                <li key={block.label} className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">{block.label}</span>
                                    <span className="font-medium">{block.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Coluna 2 */}
            <div className="lg:col-span-1">
                 {codigosSummary.length > 0 && (
                    <div className="h-full">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Códigos identificados (Sumarizado)
                        </p>
                        <div className="mt-2 space-y-3 text-sm">
                            {codigosSummary.map((summaryItem) => (
                                <div key={summaryItem.label}>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="font-medium text-foreground">{summaryItem.label}</span>
                                        <span className="font-bold">{summaryItem.total}</span>
                                    </div>
                                    <ul className="mt-1 space-y-1 pl-4">
                                        {summaryItem.risks.map(riskItem => (
                                            <li key={riskItem.label} className="flex items-center justify-between gap-4 text-xs">
                                                <span className="text-muted-foreground">{riskItem.label}</span>
                                                <span className="font-medium">{riskItem.count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Coluna 3 */}
            <div className="space-y-4">
                 {naturezaChartData && <DoughnutChart title="Por Natureza" data={naturezaChartData} />}
                {creditoChartData && <DoughnutChart title="Por Crédito" data={creditoChartData} />}
                {recomendacoes.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-2 flex items-center">
                            <FaLightbulb className="mr-2 h-4 w-4 text-amber-600" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                                Recomendações
                            </span>
                        </div>
                        <div className="space-y-1 text-xs text-amber-800">
                            {recomendacoes.slice(0, 3).map((rec, index) => (
                                <p key={index}>• {rec}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}