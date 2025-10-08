'use client';

import { useMemo } from 'react';
import { FaSpinner, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from 'react-icons/fa';
import type { CardPayload, CountBlock, IdentifiedCode, SnapshotMetadata } from '@/types/perdecomp-card';
import { formatCnpj } from '@/utils/cnpj';
import DoughnutChart from './DoughnutChart';
import {
    getRiskBadgeColor,
    normalizeRisk,
    formatDate,
    describeFamilia,
    buildApiErrorLabel,
    SourceBadge
} from './ui/card-utils';

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

  const creditosComRisco = useMemo(() => {
    if (!codigosIdentificados || codigosIdentificados.length === 0) {
      return creditos.map(c => ({ ...c, risk: 'DESCONHECIDO' }));
    }

    const riskPriority: Record<string, number> = { 'ALTO': 3, 'MÉDIO': 2, 'BAIXO': 1, 'DESCONHECIDO': 0 };
    const riskLevels: Record<number, string> = { 3: 'ALTO', 2: 'MÉDIO', 1: 'BAIXO', 0: 'DESCONHECIDO' };

    const aggregatedRisks = codigosIdentificados.reduce((acc, codigo) => {
      const tipo = codigo.credito_tipo || 'Não identificado';
      const risco = normalizeRisk(codigo.risco);
      const priority = riskPriority[risco] ?? 0;

      if (!acc[tipo] || priority > (acc[tipo] ?? 0)) {
        acc[tipo] = priority;
      }

      return acc;
    }, {} as Record<string, number>);

    return creditos.map(c => {
      const riskPriorityLevel = aggregatedRisks[c.label] ?? 0;
      const risk = riskLevels[riskPriorityLevel] || 'DESCONHECIDO';
      return { ...c, risk };
    });
  }, [creditos, codigosIdentificados]);

  const consultedAt = data?.consultedAtISO ?? card?.rendered_at_iso ?? card?.header?.ultima_consulta_iso ?? data?.lastConsultation ?? null;
  const isCached = data?.source === 'snapshot' || data?.fromCache;

  const naturezaChartData = useMemo(() => {
    if (!naturezas || naturezas.length === 0) return null;
    return {
      labels: naturezas.map(n => n.label),
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                                    <span className="text-muted-foreground">{block.label}</span>
                                    <span className="font-medium">{block.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {creditosComRisco.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por crédito:</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {creditosComRisco.map((block) => (
                                <li key={block.label} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">{block.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{block.count}</span>
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskBadgeColor(block.risk)}`}>
                                            {block.risk}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Coluna 2 */}
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