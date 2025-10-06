'use client';

import { useMemo } from 'react';
import { FaSpinner, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from 'react-icons/fa';
import type { CardPayload, CountBlock, IdentifiedCode, SnapshotMetadata } from '@/types/perdecomp-card';
import { formatCnpj } from '@/utils/cnpj';

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

interface PerdcompEnrichedCardProps {
  company: Company;
  data: CardData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: any;
  debug?: any;
  showDebug?: boolean;
  onCancelClick?: (count: number) => void;
  onDebugClick?: (company: Company, debug: any) => void;
}

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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ${color}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" className="opacity-80" aria-hidden="true">
        {isSnapshot ? (
          <path d="M12 3a9 9 0 1 0 9 9H12V3z" fill="currentColor" />
        ) : (
          <path d="M12 2a10 10 0 1 0 10 10h-2A8 8 0 1 1 12 4v8h8A8 8 0 0 1 12 2z" fill="currentColor" />
        )}
      </svg>
      {label}
      {dateLabel ? ` • ${dateLabel}` : ''}
    </span>
  );
}

function buildResumo(card: CardPayload | null | undefined, fallback?: CardData['perdcompResumo']) {
  if (fallback) return fallback;
  if (!card) return null;
  const map = new Map<string, number>();
  for (const block of card.quantos_sao || []) {
    if (!block) continue;
    const label = String(block.label || '').toUpperCase();
    if (!label) continue;
    map.set(label, Number(block.count ?? 0));
  }

  const porFamilia = {
    DCOMP: map.get('DCOMP') ?? 0,
    REST: map.get('REST') ?? 0,
    RESSARC: map.get('RESSARC') ?? 0,
    CANC: map.get('CANC') ?? 0,
    DESCONHECIDO: map.get('DESCONHECIDO') ?? 0,
  };

  const canc = porFamilia.CANC;
  const totalSemCancelamento = Number(card.quantidade_total ?? 0) || 0;
  const porNaturezaAgrupada = Object.fromEntries(
    (card.por_natureza || []).map(block => [block.label, block.count])
  );

  return {
    total: totalSemCancelamento + canc,
    totalSemCancelamento,
    canc,
    porFamilia,
    porNaturezaAgrupada,
  };
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

export default function PerdcompEnrichedCard({
  company,
  data,
  status,
  error,
  debug,
  showDebug = false,
  onCancelClick,
  onDebugClick,
}: PerdcompEnrichedCardProps) {
  const card = data?.card ?? null;
  const metadata = data?.metadata ?? null;
  const resumo = useMemo(() => buildResumo(card, data?.perdcompResumo), [card, data?.perdcompResumo]);
  const quantity = resumo?.totalSemCancelamento ?? data?.quantity ?? card?.quantidade_total ?? 0;
  const cancelamentos = resumo?.porFamilia?.CANC ?? 0;
  const consultedAt = data?.consultedAtISO ?? card?.rendered_at_iso ?? card?.header?.ultima_consulta_iso ?? data?.lastConsultation ?? null;
  const riskNivel = (card?.analise_risco?.nivel ?? metadata?.riscoNivel ?? '').toUpperCase();
  const riskTags = card?.analise_risco?.tags ?? metadata?.tagsRisco ?? [];
  const quantosSao = useMemo(() => {
    if (card?.quantos_sao && card.quantos_sao.length > 0) {
      return card.quantos_sao;
    }
    if (resumo) {
      return Object.entries(resumo.porFamilia).map(([label, count]) => ({ label, count })) as CountBlock[];
    }
    return [] as CountBlock[];
  }, [card?.quantos_sao, resumo]);
  const naturezas = (card?.por_natureza && card.por_natureza.length > 0
    ? card.por_natureza
    : metadata?.porNatureza) ?? [];
  const creditos = (card?.por_credito && card.por_credito.length > 0
    ? card.por_credito
    : metadata?.porCredito) ?? [];
  const codigosIdentificados = card?.codigos_identificados ?? [];
  const fallbackCodigos = !codigosIdentificados.length ? data?.perdcompCodigos ?? [] : [];
  const recomendacoes = card?.recomendacoes ?? [];
  const isCached = data?.source === 'snapshot' || data?.fromCache;
  const siteReceipt = data?.siteReceipt ?? card?.links?.html ?? metadata?.urlComprovanteHTML ?? null;

  return (
    <article className="group relative mx-auto flex h-full w-full max-w-[420px] flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
      <header className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground" title={company.Nome_da_Empresa}>
            {company.Nome_da_Empresa}
          </h3>
          <p className="text-xs text-muted-foreground">{formatCnpj(company.CNPJ_Empresa)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SourceBadge source={data?.source ?? (isCached ? 'snapshot' : undefined)} consultedAtISO={consultedAt} />
          {consultedAt && (
            <p className="text-[11px] text-muted-foreground">{formatDate(consultedAt)}</p>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {status === 'loading' && (
          <div className="flex flex-1 items-center justify-center text-primary">
            <FaSpinner className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-destructive">
            {buildApiErrorLabel(error)}
          </div>
        )}

        {status === 'loaded' && data && (
          <>
            {error && (
              <p className="text-sm text-destructive">{buildApiErrorLabel(error)}</p>
            )}

            {isCached && (
              <p className="text-xs text-amber-600">
                Mostrando dados salvos em {formatDate(consultedAt)}.
              </p>
            )}

            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm">
              <div className="contents">
                <dt className="text-muted-foreground">Quantidade:</dt>
                <dd className="text-right font-medium">{quantity}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Cancelamentos:</dt>
                <dd className="text-right font-medium">{cancelamentos}</dd>
              </div>
            </dl>

            {riskNivel && (
              <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Análise de risco
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getRiskBadgeColor(riskNivel)}`}>
                    {riskNivel === 'BAIXO' && <FaInfoCircle className="mr-1 h-3 w-3" />}
                    {(riskNivel === 'MÉDIO' || riskNivel === 'MEDIO' || riskNivel === 'ALTO') && (
                      <FaExclamationTriangle className="mr-1 h-3 w-3" />
                    )}
                    {riskNivel}
                  </span>
                </div>
                {riskTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {riskTags.map(tag => (
                      <span
                        key={tag.label}
                        className="inline-flex items-center rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {tag.label} • {tag.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-4">
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

            {codigosIdentificados.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Códigos identificados
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1 text-xs">
                  {codigosIdentificados.slice(0, 10).map((codigo: IdentifiedCode, index) => (
                    <div key={`${codigo.codigo}-${index}`} className="rounded-lg border border-border/40 bg-background/60 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-muted-foreground">{codigo.codigo}</span>
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${getRiskBadgeColor(codigo.risco)}`}>
                          {codigo.risco}
                        </span>
                      </div>
                      <p className="text-foreground font-medium">{codigo.credito_tipo || 'Não identificado'}</p>
                      <p className="text-muted-foreground">
                        {codigo.grupo} • {codigo.natureza}
                        {codigo.data_iso ? ` • ${formatDate(codigo.data_iso)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : fallbackCodigos.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Códigos identificados
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {fallbackCodigos.slice(0, 10).map(code => (
                    <li key={code} className="font-mono">{code}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {recomendacoes.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
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

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                onClick={() => onCancelClick?.(cancelamentos)}
              >
                Cancelamentos
              </button>
              {siteReceipt && (
                <a
                  className="text-sm text-muted-foreground hover:underline"
                  href={siteReceipt}
                  target="_blank"
                  rel="noreferrer"
                >
                  HTML
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {showDebug && status === 'loaded' && debug && (
        <button
          type="button"
          onClick={() => onDebugClick?.(company, debug)}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Ver retorno da API
        </button>
      )}
    </article>
  );
}
