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
import { decideCNPJFinalBeforeQuery } from '@/helpers/decideCNPJ';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ensureValidCnpj, formatCnpj, normalizeCnpj, onlyDigits, isCnpj, isEmptyCNPJLike } from '@/utils/cnpj';
import { fmtCNPJ } from '@/utils/cnpj-matriz';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}
interface CardData {
  quantity: number;
  lastConsultation: string | null;
  siteReceipt: string | null;
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

// Tipagem do flattened vindo do preview de enriquecimento
type Prefill = {
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  Pais_Empresa?: string;
  Estado_Empresa?: string;
  Cidade_Empresa?: string;
  Logradouro_Empresa?: string;
  Numero_Empresa?: string;
  Bairro_Empresa?: string;
  Complemento_Empresa?: string;
  CEP_Empresa?: string;
  CNPJ_Empresa?: string;
  cnpj_empresa?: string;
  cnpj?: string;
  DDI_Empresa?: string;
  Telefones_Empresa?: string;
  Observacao_Empresa?: string;
  Nome_Contato?: string;
  Email_Contato?: string;
  Cargo_Contato?: string;
  DDI_Contato?: string;
  Telefones_Contato?: string;
  Mercado?: string;
  Produto?: string;
  Area?: string;
  cliente_id?: string;
};

type CompetitorFetchState = {
  loading: boolean;
  error: string | null;
  items: Array<{ nome: string; cnpj: string }>;
};

function normalizeCompanyData(company: Company): Company {
  const cliente_id =
    company.cliente_id ??
    company.clienteId ??
    company.Cliente_ID ??
    (typeof company.id === 'string' ? company.id : undefined);

  const nome_da_empresa =
    company.nome_da_empresa ??
    company.nomeEmpresa ??
    company.Nome_da_Empresa ??
    (typeof company.nome === 'string' ? company.nome : undefined);

  const cnpj_empresa =
    company.cnpj_empresa ??
    company.cnpjEmpresa ??
    company.CNPJ_Empresa ??
    (typeof company.cnpj === 'string' ? company.cnpj : undefined);

  const empresa_id =
    company.empresa_id ??
    company.empresaId ??
    company.Empresa_ID;

  return {
    ...company,
    Cliente_ID: cliente_id,
    Nome_da_Empresa: nome_da_empresa,
    CNPJ_Empresa: cnpj_empresa,
    empresa_id,
  };
}

// --- Main Page Component ---
export default function ClientPerdecompComparativo({ initialQ = '' }: { initialQ?: string }) {
  const [client, setClient] = useState<CompanySelection | null>(null);
  const [normalizedClient, setNormalizedClient] = useState<Company | null>(null);
  const [competitors, setCompetitors] = useState<Array<CompanySelection | null>>([]);
  const MAX_COMPETITORS = 3;
  const remainingSlots = MAX_COMPETITORS - competitors.filter(c => !!c).length;
  const blockedCnpjs = useMemo(() => {
    const values: string[] = [];
    if (client?.company?.CNPJ_Empresa) {
      values.push(client.company.CNPJ_Empresa);
    }
    competitors.forEach(comp => {
      if (comp?.company?.CNPJ_Empresa) {
        values.push(comp.company.CNPJ_Empresa);
      }
    });
    return values;
  }, [client, competitors]);
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compFetch, setCompFetch] = useState<CompetitorFetchState>({ loading: false, error: null, items: [] });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  });
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState<Prefill | null>(null);
  const [modalWarning, setModalWarning] = useState(false);
  const [modalTarget, setModalTarget] = useState<{ type: 'client' | 'competitor'; index?: number } | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichTarget, setEnrichTarget] = useState<string | null>(null);
  const [enrichPreview, setEnrichPreview] = useState<any>(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [cnpjConfirmState, setCnpjConfirmState] = useState<{
    isOpen: boolean;
    matriz?: string;
    filial?: string;
    resolve?: (value: boolean) => void;
  }>({ isOpen: false });
  const [isDateAutomationEnabled, setIsDateAutomationEnabled] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{ company: Company; debug: ApiDebug } | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelCount, setCancelCount] = useState(0);
  const showDebug = false;
  const q: string = initialQ;

  // chamado pelo preview ao clicar "Usar e abrir cadastro"
  const handleUseSuggestion = (flat: Prefill) => {
    setCompanyPrefill(flat);
    setCompanyModalOpen(true);
  };

  useEffect(() => {
    if (isDateAutomationEnabled) {
      const end = new Date(endDate);
      end.setFullYear(end.getFullYear() - 5);
      setStartDate(end.toISOString().split('T')[0]);
    }
  }, [endDate, isDateAutomationEnabled]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    let newStartDate = startDate;
    let newEndDate = endDate;

    if (field === 'start') newStartDate = value;
    else newEndDate = value;

    const start = new Date(newStartDate);
    const end = new Date(newEndDate);

    const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (diffYears < 5) {
      const userConfirmed = window.confirm("Deseja realmente investigar um período menor que 05 anos?");
      if (userConfirmed) {
        setIsDateAutomationEnabled(false);
        setStartDate(newStartDate);
        setEndDate(newEndDate);
      } else {
        return;
      }
    } else {
      setIsDateAutomationEnabled(true);
      setStartDate(newStartDate);
      setEndDate(newEndDate);
    }
  };

  const updateResult = (cnpj: string, data: Partial<ComparisonResult>) => {
    const c14 = normalizeCnpj(cnpj);
    if (!c14) return;
    setResults(prev => prev.map(r => (normalizeCnpj(r.company.CNPJ_Empresa) === c14 ? { ...r, ...data } : r)));
  };

  const openMatrizFilialConfirmModal = useCallback(
    (matriz: string, filial: string): Promise<boolean> =>
      new Promise(resolve => {
        setCnpjConfirmState({ isOpen: true, matriz, filial, resolve });
      }),
    [],
  );

  const renderMatrizFilialConfirmDescription = () => {
    if (!cnpjConfirmState.matriz || !cnpjConfirmState.filial) return null;
    const filialFmt = fmtCNPJ(cnpjConfirmState.filial);
    const matrizFmt = fmtCNPJ(cnpjConfirmState.matriz);

    return (
      <>
        <p>
          Detectamos que o CNPJ <strong>{filialFmt}</strong> é de uma FILIAL.
        </p>
        <p className="mt-2">Deseja utilizar o CNPJ da filial mesmo assim?</p>
        <p className="mt-2">
          Se optar por "Usar Matriz", salvaremos o CNPJ <strong>{matrizFmt}</strong>.
        </p>
      </>
    );
  };

  const runConsultation = async (selection: CompanySelection) => {
    const { company, forceRefresh } = selection;

    // 1. Normalizar os dados da empresa para garantir que os campos esperados existam
    const normalizedCompany = normalizeCompanyData(company);

    // 2. Validação estrita para evitar falhas silenciosas
    const clienteId = normalizedCompany.Cliente_ID;
    const nomeEmpresa = normalizedCompany.Nome_da_Empresa;
    const empresaId = normalizedCompany.empresa_id;
    const rawCnpj = normalizedCompany.CNPJ_Empresa ?? '';

    let normalizedCnpj: string;
    try {
      normalizedCnpj = ensureValidCnpj(rawCnpj);
    } catch (error: any) {
      updateResult(rawCnpj, { status: 'error', error: { message: error?.message || 'CNPJ inválido. Verifique e tente novamente.' } });
      return;
    }

    if (!clienteId || !nomeEmpresa) {
      console.error('[Validation Error] Missing required fields for Perdcomp API', {
        clienteId,
        nomeEmpresa,
        company: normalizedCompany,
      });

      updateResult(normalizedCnpj, {
        status: 'error',
        error: {
          message: `Dados da empresa incompletos. ${!clienteId ? 'Cliente ID ausente.' : ''} ${!nomeEmpresa ? 'Nome da empresa ausente.' : ''}`.trim(),
        },
      });
      return;
    }

    let finalCNPJ = normalizedCnpj;
    try {
      finalCNPJ = await decideCNPJFinalBeforeQuery({
        clienteId: clienteId,
        cnpjAtual: normalizedCnpj,
        ask: openMatrizFilialConfirmModal,
      });
    } catch (error) {
      console.error('Falha ao decidir uso de matriz ou filial antes da consulta', error);
      finalCNPJ = normalizedCnpj;
    }

    // Update state if CNPJ changed (e.g. matrix/branch decision)
    const companyWithFinalCnpj: Company = { ...normalizedCompany, CNPJ_Empresa: finalCNPJ };

    if (finalCNPJ !== normalizedCompany.CNPJ_Empresa) {
      setClient(prev => {
        if (!prev || prev.company.Cliente_ID !== clienteId) return prev;
        const updatedCompany = { ...prev.company, CNPJ_Empresa: finalCNPJ };
        setNormalizedClient(normalizeCompanyData(updatedCompany));
        return { ...prev, company: updatedCompany };
      });
      setCompetitors(prev =>
        prev.map(sel =>
          sel && sel.company.Cliente_ID === clienteId
            ? { ...sel, company: { ...sel.company, CNPJ_Empresa: finalCNPJ } }
            : sel,
        ),
      );
    }

    setResults(prev =>
      prev.map(r =>
        r.company.Cliente_ID === clienteId
          ? { ...r, company: { ...r.company, CNPJ_Empresa: finalCNPJ } }
          : r,
      ),
    );

    updateResult(finalCNPJ, { status: 'loading' });

    try {
      const persistRes = await fetch('/api/sheets/cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clienteId, cnpj: finalCNPJ }),
      });
      if (!persistRes.ok) {
        const body = await persistRes.json().catch(() => null);
        console.error('[Persist CNPJ] Falha ao atualizar planilha', {
          status: persistRes.status,
          body,
        });
      }
    } catch (error) {
      console.error('[Persist CNPJ] Erro inesperado ao atualizar planilha', error);
    }

    try {
      const res = await fetch('/api/perdecomp/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: finalCNPJ,
          clienteId: clienteId,
          nomeEmpresa: nomeEmpresa,
          empresaId: empresaId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const errorObj = {
          httpStatus: data?.httpStatus,
          httpStatusText: data?.httpStatusText,
          providerCode: data?.providerCode,
          providerMessage: data?.providerMessage,
          message: data?.message,
        };
        // Special handling for non-critical "no data" error when we have fallback data
        const isNoDataError = errorObj.providerCode === 612;

        if (data.fallback) {
          const dcomp = data.fallback.dcomp ?? 0;
          const rest = data.fallback.rest ?? 0;
          const ressarc = data.fallback.ressarc ?? 0;
          const canc = data.fallback.canc ?? 0;
          const porFamilia = {
            DCOMP: dcomp,
            REST: rest,
            RESSARC: ressarc,
            CANC: canc,
            DESCONHECIDO: 0,
          };
          const porNaturezaAgrupada = {
            '1.3/1.7': dcomp,
            '1.2/1.6': rest,
            '1.1/1.5': ressarc,
          };
          const resumo = {
            total: dcomp + rest + ressarc + canc,
            totalSemCancelamento:
              data.fallback.quantidade ?? dcomp + rest + ressarc,
            canc,
            porFamilia,
            porNaturezaAgrupada,
          };
          const cardData: CardData = {
            quantity: resumo.totalSemCancelamento,
            lastConsultation: data.fallback.requested_at ?? null,
            siteReceipt: data.fallback.site_receipt ?? null,
            fromCache: true,
            perdcompResumo: resumo,
            perdcompCodigos: [], // Fallback não tem códigos individuais
          };
          // Do not show a scary error message for a simple "no data found"
          updateResult(finalCNPJ, { status: 'loaded', data: cardData, error: isNoDataError ? null : errorObj });
        } else {
          updateResult(finalCNPJ, { status: 'error', error: errorObj });
        }
        return;
      }

      const firstLinha = Array.isArray(data.linhas) ? data.linhas[0] : undefined;
      const mappedCount =
        data.mappedCount ??
        data.debug?.mappedCount ??
        (Array.isArray(data.linhas) ? data.linhas.length : 0);
      const totalPerdcomp =
        data.total_perdcomp ??
        data.debug?.total_perdcomp ??
        0;
      const siteReceipt =
        (data.site_receipt ??
          data.debug?.siteReceipts?.[0] ??
          firstLinha?.URL_Comprovante_HTML) || null;
      const lastConsultation =
        data.header?.requested_at ||
        data.debug?.header?.requested_at ||
        firstLinha?.Data_Consulta ||
        null;
      const resumo = data.perdcompResumo;
          const cardData: CardData = {
            quantity: resumo?.totalSemCancelamento ?? Math.max(totalPerdcomp, mappedCount),
            lastConsultation,
            siteReceipt,
            perdcompResumo: resumo,
            perdcompCodigos: data.perdcompCodigos || [],
          };
      updateResult(finalCNPJ, { status: 'loaded', data: cardData, debug: showDebug ? data.debug ?? null : null });

      if (showDebug && forceRefresh && (totalPerdcomp === 0 || !data.debug?.apiResponse)) {
        setPreviewPayload({ company: companyWithFinalCnpj, debug: data.debug ?? null });
        setPreviewOpen(true);
      }

    } catch (e: any) {
      updateResult(finalCNPJ, { status: 'error', error: { message: e.message } });
    }
  };

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const handleConsult = async () => {
    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => {
      const normalized = normalizeCompanyData(s.company);
      return { company: { ...normalized, CNPJ_Empresa: normalizeCnpj(normalized.CNPJ_Empresa) }, data: null, status: 'idle', debug: null };
    }));

    for (const sel of allSelections) {
      try {
        await runConsultation(sel);
        await sleep(600);
      } catch (e) {
        console.error('Falha ao consultar CNPJ', sel.company.CNPJ_Empresa, e);
        await sleep(600);
      }
    }

    setGlobalLoading(false);
  };

  const handleAddCompetitor = () => {
    if (competitors.length < MAX_COMPETITORS) setCompetitors([...competitors, null]);
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleCompetitorChange = (index: number, data: Partial<CompanySelection>) => {
    setCompetitors(prev => prev.map((c, i) => i === index ? { ...c!, ...data } : c));
  };

  const fetchCompetitorsByName = useCallback(
    async (companyName: string, { setAsBase = false }: { setAsBase?: boolean } = {}) => {
      const nome = (companyName || '').trim();
      if (!nome) {
        if (setAsBase) {
          setCompFetch({ loading: false, error: null, items: [] });
        }
        return [] as Array<{ nome: string; cnpj: string }>;
      }

      if (setAsBase) {
        setCompFetch({ loading: true, error: null, items: [] });
      }

      const digits = (value: string) => (value || '').replace(/\D+/g, '');
      const blocked = new Set<string>();
      const blockedNames = new Set<string>();
      if (client?.company?.CNPJ_Empresa) {
        const norm = digits(client.company.CNPJ_Empresa);
        if (norm) blocked.add(norm);
      }
      if (client?.company?.Nome_da_Empresa) {
        const key = String(client.company.Nome_da_Empresa).trim().toLowerCase();
        if (key) blockedNames.add(key);
      }
      competitors.forEach(existing => {
        const cnpj = existing?.company?.CNPJ_Empresa ? digits(existing.company.CNPJ_Empresa) : '';
        if (cnpj) blocked.add(cnpj);
        const nameKey = String(existing?.company?.Nome_da_Empresa ?? '').trim().toLowerCase();
        if (nameKey) blockedNames.add(nameKey);
      });

      try {
        const response = await fetch('/api/empresas/concorrentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, max: 20 }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json().catch(() => ({}));
        const items = Array.isArray(json?.items) ? json.items : [];
        const seenCnpjs = new Set<string>();
        const seenNames = new Set<string>();
        const cleaned: Array<{ nome: string; cnpj: string }> = [];

        items.forEach((raw: any) => {
          const nomeLimpo = String(raw?.nome || '').trim();
          if (nomeLimpo.length <= 1) return;

          const cnpj = digits(String(raw?.cnpj || ''));
          if (cnpj && blocked.has(cnpj)) return;

          if (cnpj) {
            if (seenCnpjs.has(cnpj)) return;
            seenCnpjs.add(cnpj);
            cleaned.push({ nome: nomeLimpo, cnpj });
            return;
          }

          const key = nomeLimpo.toLowerCase();
          if (blockedNames.has(key)) return;
          if (seenNames.has(key)) return;
          seenNames.add(key);
          cleaned.push({ nome: nomeLimpo, cnpj: '' });
        });

        if (setAsBase) {
          setCompFetch({ loading: false, error: null, items: cleaned });
        }

        return cleaned;
      } catch (error) {
        console.error('Falha ao buscar concorrentes', error);
        if (setAsBase) {
          setCompFetch({ loading: false, error: 'Falha ao buscar concorrentes', items: [] });
        }
        throw new Error('Falha ao buscar concorrentes');
      }
    },
    [client, competitors],
  );

  const handleSearchCompetitors = useCallback(
    (term: string) => fetchCompetitorsByName(term, { setAsBase: false }),
    [fetchCompetitorsByName],
  );

  function openCompetitorDialog() {
    if (!client || remainingSlots <= 0) return;
    setCompDialogOpen(true);
    const normalized = normalizeCompanyData(client.company);
    fetchCompetitorsByName(normalized.Nome_da_Empresa, { setAsBase: true }).catch(() => {
      // erros já tratados em fetchCompetitorsByName
    });
  }

  function closeCompetitorDialog() {
    setCompDialogOpen(false);
  }

  function confirmCompetitors(selected: Array<{ nome: string; cnpj: string }>) {
    const sanitized: Array<{ nome: string; cnpj: string }> = [];
    for (const item of selected) {
      const nome = String(item?.nome ?? '').trim();
      if (!nome) continue;
      const cleaned = onlyDigits(item?.cnpj ?? '');
      if (cleaned) {
        if (!isCnpj(cleaned)) {
          alert('CNPJ inválido');
          return;
        }
        sanitized.push({ nome, cnpj: cleaned });
      } else {
        sanitized.push({ nome, cnpj: '' });
      }
    }

    if (sanitized.length === 0) {
      setCompDialogOpen(false);
      return;
    }

    const existingKeys = new Set<string>();
    competitors.forEach(existing => {
      if (!existing) return;
      const cnpj = normalizeCnpj(existing.company.CNPJ_Empresa);
      if (cnpj) {
        existingKeys.add(cnpj);
        return;
      }
      const key = String(existing.company.Nome_da_Empresa || '').trim().toLowerCase();
      if (key) existingKeys.add(key);
    });
    if (client?.company?.CNPJ_Empresa) {
      const cnpj = normalizeCnpj(client.company.CNPJ_Empresa);
      if (cnpj) existingKeys.add(cnpj);
    }

    const filtered: Array<{ nome: string; cnpj: string }> = [];
    const seen = new Set<string>();
    sanitized.forEach(item => {
      const key = item.cnpj || item.nome.toLowerCase();
      if (existingKeys.has(key) || seen.has(key)) return;
      seen.add(key);
      filtered.push(item);
    });

    if (filtered.length === 0) {
      setCompDialogOpen(false);
      return;
    }

    const next = [...competitors];
    let idx = 0;
    for (let i = 0; i < next.length && idx < filtered.length; i++) {
      if (!next[i]) {
        const s = filtered[idx++];
        next[i] = {
          company: {
            Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g, '').slice(0, 20)}`,
            Nome_da_Empresa: s.nome,
            CNPJ_Empresa: s.cnpj,
          },
          lastConsultation: null,
          forceRefresh: false,
        };
      }
    }
    while (next.length < MAX_COMPETITORS && idx < filtered.length) {
      const s = filtered[idx++];
      next.push({
        company: {
          Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g, '').slice(0, 20)}`,
          Nome_da_Empresa: s.nome,
          CNPJ_Empresa: s.cnpj,
        },
        lastConsultation: null,
        forceRefresh: false,
      });
    }
    setCompetitors(next.slice(0, MAX_COMPETITORS));
    setCompDialogOpen(false);
  }

  const checkLastConsultation = async (cnpj: string, clienteId?: string): Promise<string | null> => {
    try {
      const c = ensureValidCnpj(cnpj);
      const params = new URLSearchParams({ cnpj: c });
      if (clienteId) params.append('clienteId', clienteId);
      const res = await fetch(`/api/perdecomp/verificar?${params.toString()}`);
      if (res.ok) {
        const { lastConsultation } = await res.json();
        return lastConsultation;
      }
      return null;
    } catch (error) {
      console.error('Failed to check last consultation', error);
      return null;
    }
  };

  function mergeEmptyFields(base: any, sug: any) {
    const out = { ...base };
    Object.keys(sug || {}).forEach(k => {
      const cur = String(out[k] ?? '').trim();
      const val = String(sug[k] ?? '').trim();
      if (k === 'CNPJ_Empresa') {
        const curDigits = onlyDigits(cur);
        const valDigits = normalizeCnpj(val);
        if (isEmptyCNPJLike(curDigits) && isCnpj(valDigits)) {
          out[k] = valDigits;
        }
      } else if (!cur && val) {
        out[k] = val;
      }
    });
    return out;
  }

  function openNewCompanyModal(opts: { initialData: any; warning?: boolean; target: { type: 'client' | 'competitor'; index?: number } }) {
    setCompanyPrefill(opts.initialData);
    setModalWarning(!!opts.warning);
    setModalTarget(opts.target);
    setCompanyModalOpen(true);
  }

  async function handleRegisterNewFromQuery(query: string, target: { type: 'client' | 'competitor'; index?: number }) {
    setIsEnriching(true);
    setEnrichTarget(target.type === 'client' ? 'client' : `competitor-${target.index}`);
    try {
      const r = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: query })
      });
      const { suggestion } = await r.json();
      openNewCompanyModal({ initialData: suggestion ?? { Nome_da_Empresa: query }, warning: !suggestion, target });
    } catch {
      openNewCompanyModal({ initialData: { Nome_da_Empresa: query }, warning: true, target });
    } finally {
      setIsEnriching(false);
      setEnrichTarget(null);
    }
  }

  async function handleEnrichFromMain(source: 'selected' | 'query', selectedCompany?: Company, rawQuery?: string, target?: { type: 'client' | 'competitor'; index?: number }) {
    let nome = '';
    let cnpj = '';
    if (source === 'selected' && selectedCompany) {
      nome = selectedCompany.Nome_da_Empresa || '';
      cnpj = normalizeCnpj(selectedCompany.CNPJ_Empresa);
    } else if (source === 'query' && rawQuery) {
      nome = rawQuery.trim();
    }
    if (!nome && !cnpj) return;

    setIsEnriching(true);
    setEnrichTarget(target ? (target.type === 'client' ? 'client' : `competitor-${target.index}`) : null);
    try {
      const resp = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cnpj })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Falha ao enriquecer');
      setEnrichPreview({ ...json, base: selectedCompany });
      setShowEnrichPreview(true);
      setModalTarget(target || null);
    } catch (e: any) {
      console.error(e);
      setEnrichPreview({ error: e?.toString?.() || 'Erro ao enriquecer', base: selectedCompany });
      setShowEnrichPreview(true);
      setModalTarget(target || null);
    } finally {
      setIsEnriching(false);
      setEnrichTarget(null);
    }
  }

  const handleSelectCompany = async (type: 'client' | 'competitor', company: Company, index?: number) => {
    const cnpj = normalizeCnpj(company.CNPJ_Empresa);
    const normalized = { ...company, CNPJ_Empresa: cnpj };
    const lastConsultation = isCnpj(cnpj) ? await checkLastConsultation(cnpj, company.Cliente_ID) : null;
    const selection: CompanySelection = { company: normalized, lastConsultation, forceRefresh: false };
    if (type === 'client') {
      setClient(selection);
      setNormalizedClient(normalizeCompanyData(normalized));
    } else if (type === 'competitor' && index !== undefined) {
      setCompetitors(prev => prev.map((c, i) => i === index ? selection : c));
    }
  };

  const handleSaveNewCompany = (newCompany: Company) => {
    const normalized = normalizeCompanyData(newCompany);
    if (modalTarget?.type === 'competitor' && modalTarget.index !== undefined) {
      handleSelectCompany('competitor', normalized, modalTarget.index);
    } else {
      handleSelectCompany('client', normalized);
    }
    setCompanyModalOpen(false);
    setCompanyPrefill(null);
    setModalTarget(null);
  };

  useEffect(() => {
    if (!q) return;
    (async () => {
      try {
        const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            await handleSelectCompany('client', data[0]);
            handleConsult();
          }
        }
      } catch (err) {
        console.error('Erro ao pré-preencher busca', err);
      }
    })();
  }, [q]);

  const hasResultCards = results.length > 0;
  const statusMessage = globalLoading ? 'Consultando dados do PER/DCOMP...' : '';

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Consultas</p>
          <h1 className="text-3xl font-semibold text-foreground">PER/DCOMP Comparativo</h1>
          <p className="text-sm text-muted-foreground">
            Compare quantitativos, naturezas, créditos e cancelamentos entre empresas no período selecionado.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {/* espaço reservado para ações globais se necessário */}
        </div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parâmetros da comparação</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Cliente Principal</p>
            <Autocomplete
              selectedCompany={client?.company ?? null}
              onSelect={(company) => handleSelectCompany('client', normalizeCompanyData(company))}
              onClear={() => setClient(null)}
              onNoResults={(query) => handleRegisterNewFromQuery(query, { type: 'client' })}
              onEnrichSelected={(company) => handleEnrichFromMain('selected', company, undefined, { type: 'client' })}
              onEnrichQuery={(query) => handleEnrichFromMain('query', undefined, query, { type: 'client' })}
              isEnriching={isEnriching && enrichTarget === 'client'}
              initialQuery={q}
            />
            {client?.lastConsultation && (
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Última consulta em {new Date(client.lastConsultation).toLocaleDateString()}
              </div>
            )}
            {client?.lastConsultation && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={client.forceRefresh}
                  onChange={(event) => setClient((c) => (c ? { ...c, forceRefresh: event.target.checked } : null))}
                  className="h-4 w-4 rounded border border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span>Refazer consulta ao atualizar</span>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="startDate" className="text-sm font-semibold text-foreground">
              Período Início
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(event) => handleDateChange('start', event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="endDate" className="text-sm font-semibold text-foreground">
              Período Fim
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(event) => handleDateChange('end', event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Concorrentes (até 3)</h3>
            <p className="text-xs text-muted-foreground">Espaços disponíveis: {remainingSlots}</p>
          </div>

          {competitors.map((comp, index) => (
            <div key={index} className="rounded-2xl border border-border/60 bg-background/40 p-4 shadow-inner">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Autocomplete
                    selectedCompany={comp?.company ?? null}
                    onSelect={(company) => handleSelectCompany('competitor', normalizeCompanyData(company), index)}
                    onClear={() => handleRemoveCompetitor(index)}
                    onNoResults={(query) => handleRegisterNewFromQuery(query, { type: 'competitor', index })}
                    onEnrichSelected={(company) => handleEnrichFromMain('selected', company, undefined, { type: 'competitor', index })}
                    onEnrichQuery={(query) => handleEnrichFromMain('query', undefined, query, { type: 'competitor', index })}
                    isEnriching={isEnriching && enrichTarget === `competitor-${index}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCompetitor(index)}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Remover concorrente ${index + 1}`}
                >
                  Remover
                </button>
              </div>

              {comp?.lastConsultation && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Última consulta em {new Date(comp.lastConsultation).toLocaleDateString()}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={comp.forceRefresh}
                      onChange={(event) => handleCompetitorChange(index, { forceRefresh: event.target.checked })}
                      className="h-4 w-4 rounded border border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <span>Refazer consulta ao atualizar</span>
                  </label>
                </div>
              )}
            </div>
          ))}

          {competitors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adicione concorrentes manualmente ou utilize a pesquisa automática.
            </p>
          )}

          <div className="mt-1 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleConsult}
              disabled={globalLoading || !client}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={globalLoading ? 'Consultando PER/DCOMP' : 'Consultar PER/DCOMP'}
            >
              {globalLoading && <FaSpinner className="mr-2 h-4 w-4 animate-spin" />}
              {globalLoading ? 'Consultando...' : 'Consultar / Atualizar Comparação'}
            </button>
            <button
              type="button"
              onClick={openCompetitorDialog}
              disabled={!client || remainingSlots === 0}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pesquisar Concorrentes
            </button>
            <button
              type="button"
              onClick={handleAddCompetitor}
              disabled={remainingSlots === 0 || competitors.length >= MAX_COMPETITORS}
              className="inline-flex items-center justify-center rounded-xl border border-dashed border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Adicionar Concorrente
            </button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </section>

      <section className="relative -mx-2 rounded-3xl border border-border bg-muted/40 p-4 shadow-soft">
        {hasResultCards ? (
          <div
            className="grid grid-cols-4 gap-4 overflow-x-hidden px-2 py-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Resultados da comparação PER/DCOMP"
          >
            {results.map(({ company, data, status, error, debug }) => (
              <PerdcompEnrichedCard
                key={company.CNPJ_Empresa}
                company={company}
                data={data}
                status={status}
                error={error}
                debug={debug}
                showDebug={showDebug}
                onCancelClick={(count) => {
                  setCancelCount(count);
                  setOpenCancel(true);
                }}
                onDebugClick={(company, debug) => {
                  setPreviewPayload({ company, debug });
                  setPreviewOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground" aria-live="polite">
            Nenhum resultado para os filtros aplicados.
          </div>
        )}
      </section>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent aria-describedby="cancel-desc" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelamentos</DialogTitle>
            <p id="cancel-desc" className="text-sm text-muted-foreground">
              Itens cancelados no período considerado.
            </p>
          </DialogHeader>

          <div className="px-6 pb-4 text-sm text-foreground">
            Quantidade: <span className="font-semibold">{cancelCount}</span>
          </div>

          <DialogFooter className="border-t border-border/60 bg-card px-6 py-4">
            <button
              type="button"
              onClick={() => setOpenCancel(false)}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnrichmentPreviewDialog
        isOpen={showEnrichPreview}
        onClose={() => { setShowEnrichPreview(false); setModalTarget(null); }}
        suggestionFlat={enrichPreview?.suggestion || null}
        baseCompany={enrichPreview?.base || null}
        rawJson={enrichPreview?.debug?.parsedJson}
        error={enrichPreview?.error ? String(enrichPreview.error) : undefined}
        onConfirm={(flat) => {
          const merged = enrichPreview?.base ? mergeEmptyFields(enrichPreview.base, flat) : flat;
          // The CNPJ decision is now made inside the dialog, so we just use the result (flat).
          // However, we still need to merge other fields.
          const finalData = { ...merged, CNPJ_Empresa: flat.CNPJ_Empresa };
          handleUseSuggestion(finalData);
          setModalWarning(!enrichPreview?.suggestion);
          setShowEnrichPreview(false);
        }}
      />

      <CompetitorSearchDialog
        isOpen={compDialogOpen}
        onClose={closeCompetitorDialog}
        clientName={client?.company.Nome_da_Empresa || ''}
        limitRemaining={remainingSlots}
        blockedCnpjs={blockedCnpjs}
        fetchState={compFetch}
        onSearch={handleSearchCompetitors}
        onConfirm={confirmCompetitors}
      />

      <ConfirmDialog
        isOpen={cnpjConfirmState.isOpen}
        onClose={() => {
          cnpjConfirmState.resolve?.(false);
          setCnpjConfirmState({ isOpen: false });
        }}
        onConfirm={() => {
          cnpjConfirmState.resolve?.(true);
          setCnpjConfirmState({ isOpen: false });
        }}
        title="CNPJ indica Filial"
        description={renderMatrizFilialConfirmDescription()}
        confirmText="Usar Matriz"
        cancelText="Manter Filial"
      />

      <NewCompanyModal
        isOpen={companyModalOpen}
        initialData={companyPrefill || undefined}
        warning={modalWarning}
        onClose={() => {
          setCompanyModalOpen(false);
          setCompanyPrefill(null);
        }}
        onSaved={handleSaveNewCompany}
      />

      {showDebug && (
        <PerdcompApiPreviewDialog
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          company={previewPayload?.company || null}
          debug={previewPayload?.debug || null}
        />
      )}
    </div>
  );
}
