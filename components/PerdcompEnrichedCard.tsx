'use client';

import { useMemo } from 'react';
import { FaSpinner, FaExclamationTriangle, FaInfoCircle, FaLightbulb } from 'react-icons/fa';
import { enriquecerPerdcomp, analisarPortfolioPerdcomp } from '@/lib/perdcomp';
import { formatCnpj } from '@/utils/cnpj';

interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

interface CardData {
  lastConsultation: string | null;
  quantity: number;
  siteReceipt?: string | null;
  fromCache?: boolean;
  perdcompResumo?: {
    total: number;
    totalSemCancelamento: number;
    canc: number;
    porFamilia: { DCOMP: number; REST: number; RESSARC: number; CANC: number; DESCONHECIDO: number };
    porNaturezaAgrupada: Record<string, number>;
  };
  perdcompCodigos?: string[]; // Array de códigos PER/DCOMP de 24 dígitos
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
    parts.push(
      `API error: ${e.httpStatus}${e.httpStatusText ? ' ' + e.httpStatusText : ''}`,
    );
  } else {
    parts.push('API error:');
  }
  if (e?.message) {
    parts.push(e.message);
  }
  return parts.join(' ');
}

function getRiskBadgeColor(nivel: 'BAIXO' | 'MEDIO' | 'ALTO') {
  switch (nivel) {
    case 'BAIXO':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'MEDIO':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'ALTO':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getCategoryBadgeColor(categoria: string) {
  const colors: Record<string, string> = {
    'IPI': 'bg-blue-100 text-blue-800 border-blue-200',
    'IRPJ': 'bg-purple-100 text-purple-800 border-purple-200',
    'PIS/Cofins': 'bg-teal-100 text-teal-800 border-teal-200',
    'Retenções': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Incentivos Fiscais': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'eSocial': 'bg-orange-100 text-orange-800 border-orange-200',
    'Genérico': 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[categoria] || 'bg-gray-100 text-gray-800 border-gray-200';
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
  const resumo = data?.perdcompResumo;
  const temRegistros = (resumo?.totalSemCancelamento ?? 0) > 0;
  const cancelamentos = resumo?.canc ?? resumo?.porFamilia?.CANC ?? 0;
  const ultimaConsulta = data?.lastConsultation || null;

  // Análise enriquecida dos códigos PER/DCOMP
  const analiseEnriquecida = useMemo(() => {
    if (!data?.perdcompCodigos || data.perdcompCodigos.length === 0) {
      return null;
    }
    
    return analisarPortfolioPerdcomp(data.perdcompCodigos);
  }, [data?.perdcompCodigos]);

  // Análise individual dos códigos mais relevantes
  const codigosEnriquecidos = useMemo(() => {
    if (!data?.perdcompCodigos || data.perdcompCodigos.length === 0) {
      return [];
    }
    
    return data.perdcompCodigos
      .slice(0, 5) // Mostrar apenas os 5 primeiros
      .map(codigo => enriquecerPerdcomp(codigo))
      .filter(analise => analise.valido);
  }, [data?.perdcompCodigos]);

  return (
    <article className="group relative mx-auto flex h-full w-full max-w-[420px] flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
      <header className="mb-2">
        <h3 className="text-lg font-semibold text-foreground" title={company.Nome_da_Empresa}>
          {company.Nome_da_Empresa}
        </h3>
        <p className="text-xs text-muted-foreground">{formatCnpj(company.CNPJ_Empresa)}</p>
        {ultimaConsulta && (
          <p className="mt-1 text-xs text-muted-foreground">
            Última consulta: {new Date(ultimaConsulta).toLocaleDateString()}
          </p>
        )}
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
              <p className="text-sm text-destructive">
                {buildApiErrorLabel(error)}
              </p>
            )}
            {data.fromCache && (
              <p className="text-xs text-amber-600">
                Mostrando dados da última consulta em{' '}
                {data.lastConsultation ? new Date(data.lastConsultation).toLocaleDateString() : ''}
              </p>
            )}

            {/* Métricas básicas */}
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm">
              <div className="contents">
                <dt className="text-muted-foreground">Quantidade:</dt>
                <dd className="text-right font-medium">{resumo?.totalSemCancelamento ?? data.quantity ?? 0}</dd>
              </div>
            </dl>

            {/* Análise de risco geral */}
            {analiseEnriquecida && (
              <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Análise de Risco
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getRiskBadgeColor(analiseEnriquecida.nivelRiscoGeral)}`}>
                    {analiseEnriquecida.nivelRiscoGeral === 'BAIXO' && <FaInfoCircle className="mr-1 h-3 w-3" />}
                    {analiseEnriquecida.nivelRiscoGeral === 'MEDIO' && <FaExclamationTriangle className="mr-1 h-3 w-3" />}
                    {analiseEnriquecida.nivelRiscoGeral === 'ALTO' && <FaExclamationTriangle className="mr-1 h-3 w-3" />}
                    {analiseEnriquecida.nivelRiscoGeral}
                  </span>
                </div>
                
                {/* Distribuição por categoria */}
                <div className="space-y-1">
                  {Object.entries(analiseEnriquecida.distribuicaoPorCategoria).map(([categoria, count]) => (
                    <div key={categoria} className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getCategoryBadgeColor(categoria)}`}>
                        {categoria}
                      </span>
                      <span className="text-xs font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {temRegistros ? (
              <div className="mt-4 space-y-4">
                {/* Quantos são */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantos são:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(resumo?.porNaturezaAgrupada || {}).map(([cod, qtd]) => (
                      <li key={cod} className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {cod === '1.3/1.7'
                            ? 'DCOMP (Declarações de Compensação)'
                            : cod === '1.2/1.6'
                            ? 'REST (Pedidos de Restituição)'
                            : cod === '1.1/1.5'
                            ? 'RESSARC (Pedidos de Ressarcimento)'
                            : cod}
                        </span>
                        <span className="font-medium">{qtd}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Por tipo de naturezas */}
                {analiseEnriquecida?.distribuicaoPorNatureza && Object.keys(analiseEnriquecida.distribuicaoPorNatureza).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por tipo de naturezas:</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {Object.entries(analiseEnriquecida.distribuicaoPorNatureza).map(([natureza, qtd]) => (
                        <li key={natureza} className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">{natureza}</span>
                          <span className="font-medium">{qtd}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Por tipo de Crédito */}
                {analiseEnriquecida?.distribuicaoPorCredito && Object.keys(analiseEnriquecida.distribuicaoPorCredito).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por tipo de Crédito:</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {Object.entries(analiseEnriquecida.distribuicaoPorCredito).map(([credito, qtd]) => (
                        <li key={credito} className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">{credito}</span>
                          <span className="font-medium">{qtd}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
                Nenhum PER/DCOMP encontrado no período.
              </div>
            )}

            {/* Códigos enriquecidos individuais */}
            {codigosEnriquecidos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Códigos Identificados:
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {codigosEnriquecidos.map((analise, index) => (
                    <div key={index} className="rounded-lg border border-border/40 bg-background/60 p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-muted-foreground">{analise.formatted}</span>
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium ${getRiskBadgeColor(analise.nivelRisco!)}`}>
                          {analise.nivelRisco}
                        </span>
                      </div>
                      <p className="text-foreground font-medium">{analise.descricaoCredito}</p>
                      <p className="text-muted-foreground">{analise.categoria} • {analise.tipoDocumento}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações estratégicas */}
            {analiseEnriquecida?.recomendacoesPrioritarias && analiseEnriquecida.recomendacoesPrioritarias.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center mb-2">
                  <FaLightbulb className="mr-2 h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Recomendações
                  </span>
                </div>
                <div className="space-y-1">
                  {analiseEnriquecida.recomendacoesPrioritarias.slice(0, 2).map((rec, index) => (
                    <p key={index} className="text-xs text-amber-800 leading-relaxed">
                      • {rec}
                    </p>
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
              {data.siteReceipt && (
                <a
                  className="text-sm text-muted-foreground hover:underline"
                  href={data.siteReceipt}
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
