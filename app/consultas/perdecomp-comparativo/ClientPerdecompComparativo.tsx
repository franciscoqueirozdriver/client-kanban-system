'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal from '../../../components/NewCompanyModal';
import CompetitorSearchDialog from '../../../components/CompetitorSearchDialog';
import PerdcompApiPreviewDialog from '../../../components/PerdcompApiPreviewDialog';
import EnrichmentPreviewDialog from '../../../components/EnrichmentPreviewDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import PerdcompEnrichedCard from '../../../components/PerdcompEnrichedCard';
import MainClientCard from '../../../components/MainClientCard';
import { decideCNPJFinalBeforeQuery } from '@/helpers/decideCNPJ';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ensureValidCnpj, formatCnpj, normalizeCnpj, onlyDigits, isCnpj, isEmptyCNPJLike } from '@/utils/cnpj';
import { fmtCNPJ } from '@/utils/cnpj-matriz';
import type { CardPayload, SnapshotMetadata } from '@/types/perdecomp-card';

// --- Helper Types ---
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

type ApiDebug = {
  requestedAt?: string;
  fonte?: 'api' | 'planilha';
  apiRequest?: any;
  apiResponse?: any;
  mappedCount?: number;
  siteReceipts?: string[];
  header?: any;
  total_perdcomp?: number;
} | null;

interface ComparisonResult {
  company: Company; data: CardData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error'; error?: any;
  debug?: ApiDebug;
}

interface CompanySelection {
  company: Company; lastConsultation: string | null; forceRefresh: boolean;
}

type Prefill = {
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  CNPJ_Empresa?: string;
  // ... other fields
};

type CompetitorFetchState = {
  loading: boolean;
  error: string | null;
  items: Array<{ nome: string; cnpj: string }>;
};

function buildResumoFromCardPayload(card?: CardPayload | null) {
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

// --- Main Page Component ---
export default function ClientPerdecompComparativo({ initialQ = '' }: { initialQ?: string }) {
  const [client, setClient] = useState<CompanySelection | null>(null);
  const [competitors, setCompetitors] = useState<Array<CompanySelection | null>>([]);
  const MAX_COMPETITORS = 3;
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  });

  // Other states...
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compFetch, setCompFetch] = useState<CompetitorFetchState>({ loading: false, error: null, items: [] });
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState<Prefill | null>(null);
  const [modalWarning, setModalWarning] = useState(false);
  const [modalTarget, setModalTarget] = useState<{ type: 'client' | 'competitor'; index?: number } | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichTarget, setEnrichTarget] = useState<string | null>(null);
  const [enrichPreview, setEnrichPreview] = useState<any>(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [cnpjConfirmState, setCnpjConfirmState] = useState<{ isOpen: boolean; matriz?: string; filial?: string; resolve?: (value: boolean) => void; }>({ isOpen: false });
  const [isDateAutomationEnabled, setIsDateAutomationEnabled] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{ company: Company; debug: ApiDebug } | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelCount, setCancelCount] = useState(0);

  const remainingSlots = MAX_COMPETITORS - competitors.filter(c => !!c).length;
  const showDebug = false;

  const updateResult = useCallback((cnpj: string, data: Partial<ComparisonResult>) => {
    const c14 = normalizeCnpj(cnpj);
    if (!c14) return;
    setResults(prev => prev.map(r => (normalizeCnpj(r.company.CNPJ_Empresa) === c14 ? { ...r, ...data } : r)));
  }, []);

  const openMatrizFilialConfirmModal = useCallback((matriz: string, filial: string): Promise<boolean> =>
    new Promise(resolve => {
      setCnpjConfirmState({ isOpen: true, matriz, filial, resolve });
    }),
  []);

  const runConsultation = useCallback(async (selection: CompanySelection) => {
    const { company, forceRefresh } = selection;
    let finalCNPJ = normalizeCnpj(company.CNPJ_Empresa);

    try {
      finalCNPJ = await decideCNPJFinalBeforeQuery({ clienteId: company.Cliente_ID, cnpjAtual: finalCNPJ, ask: openMatrizFilialConfirmModal });
    } catch (error) {
      console.error('Falha ao decidir uso de matriz ou filial', error);
    }

    updateResult(company.CNPJ_Empresa, { status: 'loading' });

    try {
      const res = await fetch(`/api/infosimples/perdcomp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: finalCNPJ,
          data_inicio: startDate,
          data_fim: endDate,
          force: forceRefresh,
          clienteId: company.Cliente_ID,
          nomeEmpresa: company.Nome_da_Empresa,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.message || 'Erro na API');

      const cardPayload: CardPayload | null = data.card ?? null;
      const derivedResumo = buildResumoFromCardPayload(cardPayload);

      const cardData: CardData = {
        card: cardPayload,
        metadata: data.metadata ?? null,
        source: data.source,
        consultedAtISO: data.consultedAtISO,
        quantity: cardPayload?.quantidade_total ?? derivedResumo?.totalSemCancelamento ?? 0,
        lastConsultation: data.consultedAtISO,
        siteReceipt: data.site_receipt,
        fromCache: data.source === 'snapshot',
        perdcompResumo: derivedResumo,
        perdcompCodigos: cardPayload?.codigos_identificados?.map(c => c.codigo) ?? [],
      };
      updateResult(finalCNPJ, { status: 'loaded', data: cardData });

    } catch (e: any) {
      updateResult(finalCNPJ, { status: 'error', error: { message: e.message } });
    }
  }, [updateResult, openMatrizFilialConfirmModal, startDate, endDate]);

  const handleConsult = useCallback(async (selectionsOverride?: CompanySelection[]) => {
    const allSelections = selectionsOverride ?? [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => ({ company: { ...s.company, CNPJ_Empresa: normalizeCnpj(s.company.CNPJ_Empresa) }, data: null, status: 'idle' })));

    for (const sel of allSelections) {
      await runConsultation(sel);
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    setGlobalLoading(false);
  }, [client, competitors, runConsultation]);

  const checkLastConsultation = useCallback(async (cnpj: string): Promise<string | null> => {
    try {
      const c = ensureValidCnpj(cnpj);
      const res = await fetch(`/api/perdecomp/verificar?cnpj=${c}`);
      return res.ok ? (await res.json()).lastConsultation : null;
    } catch (error) {
      console.error('Failed to check last consultation', error);
      return null;
    }
  }, []);

  const handleSelectCompany = useCallback(async (type: 'client' | 'competitor', company: Company, index?: number) => {
    const cnpj = normalizeCnpj(company.CNPJ_Empresa);
    const normalized = { ...company, CNPJ_Empresa: cnpj };
    const lastConsultation = isCnpj(cnpj) ? await checkLastConsultation(cnpj) : null;
    const selection: CompanySelection = { company: normalized, lastConsultation, forceRefresh: false };

    if (type === 'client') {
      setClient(selection);
    } else if (type === 'competitor' && index !== undefined) {
      setCompetitors(prev => prev.map((c, i) => i === index ? selection : c));
    }
  }, [checkLastConsultation]);

  useEffect(() => {
    if (!initialQ) return;
    (async () => {
      try {
        const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(initialQ)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const company = data[0];
            const cnpj = normalizeCnpj(company.CNPJ_Empresa);
            const normalized = { ...company, CNPJ_Empresa: cnpj };
            const lastConsultation = isCnpj(cnpj) ? await checkLastConsultation(cnpj) : null;
            const selection: CompanySelection = { company: normalized, lastConsultation, forceRefresh: false };
            setClient(selection);
            handleConsult([selection]);
          }
        }
      } catch (err) {
        console.error('Erro ao pré-preencher busca', err);
      }
    })();
  }, [initialQ, checkLastConsultation, handleConsult]);

  const mainClientResult = useMemo(() => client ? results.find(r => r.company.Cliente_ID === client.company.Cliente_ID) : null, [client, results]);
  const competitorResults = useMemo(() => client ? results.filter(r => r.company.Cliente_ID !== client.company.Cliente_ID) : results, [client, results]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header and other components remain the same */}
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Consultas</p>
          <h1 className="text-3xl font-semibold text-foreground">PER/DCOMP Comparativo</h1>
          <p className="text-sm text-muted-foreground">
            Compare quantitativos, naturezas, créditos e cancelamentos entre empresas no período selecionado.
          </p>
        </div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parâmetros da comparação</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Cliente Principal</p>
            <Autocomplete
              selectedCompany={client?.company ?? null}
              onSelect={(c) => handleSelectCompany('client', c)}
              onClear={() => setClient(null)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="startDate" className="text-sm font-semibold text-foreground">Período Início</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
          </div>
          <div className="space-y-2">
            <label htmlFor="endDate" className="text-sm font-semibold text-foreground">Período Fim</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
          </div>
        </div>
        <div className="mt-4">
          <button type="button" onClick={() => handleConsult()} disabled={globalLoading || !client} className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
            {globalLoading && <FaSpinner className="mr-2 h-4 w-4 animate-spin" />}
            {globalLoading ? 'Consultando...' : 'Consultar / Atualizar Comparação'}
          </button>
        </div>
      </section>

      <section className="relative -mx-2 rounded-3xl border-border bg-muted/40 p-4 shadow-soft">
        {mainClientResult && (
          <div className="mb-4">
            <MainClientCard
              key={mainClientResult.company.CNPJ_Empresa}
              company={mainClientResult.company}
              data={mainClientResult.data}
              status={mainClientResult.status}
              error={mainClientResult.error}
            />
          </div>
        )}
        {competitorResults.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Concorrentes</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {competitorResults.map(({ company, data, status, error }) => (
                <PerdcompEnrichedCard
                  key={company.CNPJ_Empresa}
                  company={company}
                  data={data}
                  status={status}
                  error={error}
                />
              ))}
            </div>
          </>
        )}
        {!results.length && !globalLoading && (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Nenhum resultado para os filtros aplicados.
          </div>
        )}
      </section>
    </div>
  );
}