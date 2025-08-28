'use client';

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal from '../../../components/NewCompanyModal';
import CompetitorSearchDialog from '../../../components/CompetitorSearchDialog';
import PerdcompApiPreviewDialog from '../../../components/PerdcompApiPreviewDialog';
import EnrichmentPreviewDialog from '../../../components/EnrichmentPreviewDialog';
import { padCNPJ14, isValidCNPJ, normalizeDigits, isEmptyCNPJLike, isCNPJ14 } from '@/utils/cnpj';

// --- Helper Types ---
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
};

function buildApiErrorLabel(e: any) {
  const parts: string[] = [];
  if (e?.httpStatus) {
    parts.push(
      `API error: ${e.httpStatus}${e.httpStatusText ? ' ' + e.httpStatusText : ''}`,
    );
  } else {
    parts.push('API error:');
  }
  if (e?.providerCode) {
    parts.push(
      `– ${e.providerCode}${e?.providerMessage ? ' ' + e.providerMessage : ''}`,
    );
  } else if (e?.message) {
    parts.push(`– ${e.message}`);
  }
  return parts.join(' ');
}
// --- Main Page Component ---
export default function ClientPerdecompComparativo({ initialQ = '' }: { initialQ?: string }) {
  const [client, setClient] = useState<CompanySelection | null>(null);
  const [competitors, setCompetitors] = useState<Array<CompanySelection | null>>([]);
  const MAX_COMPETITORS = 3;
  const remainingSlots = MAX_COMPETITORS - competitors.filter(c => !!c).length;
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compFetch, setCompFetch] = useState<{loading: boolean; error: string|null; items: Array<{nome:string; cnpj:string}>}>({ loading: false, error: null, items: [] });
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
    const c14 = padCNPJ14(cnpj);
    setResults(prev => prev.map(r => padCNPJ14(r.company.CNPJ_Empresa) === c14 ? { ...r, ...data } : r));
  };

  const runConsultation = async (selection: CompanySelection) => {
    const { company, forceRefresh } = selection;
    const cnpj = padCNPJ14(company.CNPJ_Empresa);
    if (!isValidCNPJ(cnpj)) {
      updateResult(cnpj, { status: 'error', error: { message: 'CNPJ inválido. Verifique e tente novamente.' } });
      return;
    }
    updateResult(cnpj, { status: 'loading' });
    try {
      const res = await fetch('/api/infosimples/perdcomp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj,
          data_inicio: startDate,
          data_fim: endDate,
          force: forceRefresh,
          debug: showDebug,
          Cliente_ID: company.Cliente_ID,
          nomeEmpresa: company.Nome_da_Empresa,
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
          };
          updateResult(cnpj, { status: 'loaded', data: cardData, error: errorObj });
        } else {
          updateResult(cnpj, { status: 'error', error: errorObj });
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
      };
      updateResult(cnpj, { status: 'loaded', data: cardData, debug: showDebug ? data.debug ?? null : null });

      if (showDebug && forceRefresh && (totalPerdcomp === 0 || !data.debug?.apiResponse)) {
        setPreviewPayload({ company, debug: data.debug ?? null });
        setPreviewOpen(true);
      }

    } catch (e: any) {
      updateResult(cnpj, { status: 'error', error: { message: e.message } });
    }
  };

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const handleConsult = async () => {
    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => ({ company: { ...s.company, CNPJ_Empresa: padCNPJ14(s.company.CNPJ_Empresa) }, data: null, status: 'idle', debug: null })));

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

  function openCompetitorDialog() {
    if (!client || remainingSlots <= 0) return;
    setCompDialogOpen(true);
    setCompFetch({ loading: true, error: null, items: [] });

    fetch('/api/empresas/concorrentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: client.company.Nome_da_Empresa, max: 20 })
    })
    .then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Falha na busca');
      const selCnpjs = new Set(competitors.filter(Boolean).map(c => padCNPJ14(c!.company.CNPJ_Empresa)));
      const clientCnpj = padCNPJ14(client.company.CNPJ_Empresa);

      const items = (data.items || []).filter((it: any) => {
        const c = padCNPJ14(it?.cnpj);
        const isClient = c && clientCnpj && c === clientCnpj;
        const already = c && selCnpjs.has(c);
        const nameDup = competitors.filter(Boolean).some(cmp => cmp!.company.Nome_da_Empresa.toLowerCase() === String(it?.nome || '').toLowerCase());
        return !isClient && !already && !nameDup;
      });

      setCompFetch({ loading: false, error: null, items });
    })
    .catch(err => setCompFetch({ loading: false, error: String(err?.message || err), items: [] }));
  }

  function closeCompetitorDialog() {
    setCompDialogOpen(false);
  }

  function confirmCompetitors(selected: Array<{ nome:string; cnpj:string }>) {
    const next = [...competitors];
    let idx = 0;
    for (let i = 0; i < next.length && idx < selected.length; i++) {
      if (!next[i]) {
        const s = selected[idx++];
        next[i] = {
          company: {
            Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g,'').slice(0,20)}`,
            Nome_da_Empresa: s.nome,
            CNPJ_Empresa: padCNPJ14(s.cnpj),
          },
          lastConsultation: null,
          forceRefresh: false,
        };
      }
    }
    while (next.length < MAX_COMPETITORS && idx < selected.length) {
      const s = selected[idx++];
      next.push({
        company: {
          Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g,'').slice(0,20)}`,
          Nome_da_Empresa: s.nome,
          CNPJ_Empresa: padCNPJ14(s.cnpj),
        },
        lastConsultation: null,
        forceRefresh: false,
      });
    }
    setCompetitors(next.slice(0, MAX_COMPETITORS));
    setCompDialogOpen(false);
  }

  const checkLastConsultation = async (cnpj: string): Promise<string | null> => {
    try {
      const c = padCNPJ14(cnpj);
      const res = await fetch(`/api/perdecomp/verificar?cnpj=${c}`);
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
        const curDigits = normalizeDigits(cur);
        const valDigits = normalizeDigits(val);
        if (isEmptyCNPJLike(curDigits) && isCNPJ14(valDigits)) {
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
      cnpj = padCNPJ14(selectedCompany.CNPJ_Empresa);
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
    const cnpj = padCNPJ14(company.CNPJ_Empresa);
    const normalized = { ...company, CNPJ_Empresa: cnpj };
    const lastConsultation = await checkLastConsultation(cnpj);
    const selection: CompanySelection = { company: normalized, lastConsultation, forceRefresh: false };
    if (type === 'client') {
      setClient(selection);
    } else if (type === 'competitor' && index !== undefined) {
      setCompetitors(prev => prev.map((c, i) => i === index ? selection : c));
    }
  };

  const handleSaveNewCompany = (newCompany: Company) => {
    if (modalTarget?.type === 'competitor' && modalTarget.index !== undefined) {
      handleSelectCompany('competitor', newCompany, modalTarget.index);
    } else {
      handleSelectCompany('client', newCompany);
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

  return (
    <div className="container mx-auto p-4 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">Comparativo PER/DCOMP</h1>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="font-semibold block mb-2">Cliente Principal</label>
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <Autocomplete
                  selectedCompany={client?.company ?? null}
                  onSelect={(company) => handleSelectCompany('client', company)}
                  onClear={() => setClient(null)}
                  onNoResults={(q) => handleRegisterNewFromQuery(q, { type: 'client' })}
                  onEnrichSelected={(company) => handleEnrichFromMain('selected', company, undefined, { type: 'client' })}
                  onEnrichQuery={(q) => handleEnrichFromMain('query', undefined, q, { type: 'client' })}
                  isEnriching={isEnriching && enrichTarget === 'client'}
                  initialQuery={q}
                />
              </div>
            </div>
            {client?.lastConsultation && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={client.forceRefresh} onChange={(e) => setClient(c => c ? {...c, forceRefresh: e.target.checked} : null)} className="form-checkbox h-4 w-4 text-violet-600"/>
                  <span>Refazer consulta (última em: {new Date(client.lastConsultation).toLocaleDateString()})</span>
                </label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="endDate" className="font-semibold block mb-2">Período Fim</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => handleDateChange('end', e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
            </div>
            <div>
              <label htmlFor="startDate" className="font-semibold block mb-2">Período Início</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => handleDateChange('start', e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
            </div>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Concorrentes (até 3)</h3>
          {competitors.map((comp, index) => (
            <div key={index} className="mb-4">
              <div className="flex items-center gap-2">
                <div className="flex-grow">
                  <Autocomplete
                    selectedCompany={comp?.company ?? null}
                    onSelect={(company) => handleSelectCompany('competitor', company, index)}
                    onClear={() => handleRemoveCompetitor(index)}
                    onNoResults={(q) => handleRegisterNewFromQuery(q, { type: 'competitor', index })}
                    onEnrichSelected={(company) => handleEnrichFromMain('selected', company, undefined, { type: 'competitor', index })}
                    onEnrichQuery={(q) => handleEnrichFromMain('query', undefined, q, { type: 'competitor', index })}
                    isEnriching={isEnriching && enrichTarget === `competitor-${index}`}
                  />
                </div>
                <button onClick={() => handleRemoveCompetitor(index)} className="text-red-500 hover:text-red-700 font-bold p-2">X</button>
              </div>
              {comp?.lastConsultation && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={comp.forceRefresh} onChange={(e) => handleCompetitorChange(index, { forceRefresh: e.target.checked })} className="form-checkbox h-4 w-4 text-violet-600"/>
                    <span>Refazer consulta (última em: {new Date(comp.lastConsultation).toLocaleDateString()})</span>
                  </label>
                </div>
              )}
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleAddCompetitor}
              disabled={remainingSlots === 0 || competitors.length >= MAX_COMPETITORS}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              + Adicionar Concorrente
            </button>
            <button
              onClick={openCompetitorDialog}
              disabled={!client || remainingSlots === 0}
              className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Pesquisar Concorrentes
            </button>
          </div>
        </div>
        <div className="mt-8 text-center">
            <button onClick={handleConsult} disabled={globalLoading || !client} className="px-8 py-3 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto">
              {globalLoading && <FaSpinner className="animate-spin mr-2" />}
              {globalLoading ? 'Consultando...' : 'Consultar / Atualizar Comparação'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map(({ company, data, status, error, debug }) => (
          <div key={company.CNPJ_Empresa} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col">
            <h3 className="font-bold text-lg truncate mb-1" title={company.Nome_da_Empresa}>{company.Nome_da_Empresa}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{padCNPJ14(company.CNPJ_Empresa)}</p>

            {status === 'loading' && <div className="flex-grow flex items-center justify-center"><FaSpinner className="animate-spin text-4xl text-violet-500"/></div>}
            {status === 'error' && (
              <div className="flex-grow flex items-center justify-center text-red-500 text-sm text-center whitespace-pre-line">
                {buildApiErrorLabel(error)}
              </div>
            )}
            {status === 'loaded' && data && (() => {
              const resumo = data.perdcompResumo;
              const temRegistros = (resumo?.totalSemCancelamento ?? 0) > 0;
              return (
                <div className="flex-grow flex flex-col">
                  {error && (
                    <p className="text-red-500 text-sm whitespace-pre-line mb-2">{buildApiErrorLabel(error)}</p>
                  )}
                  {data.fromCache && (
                    <p className="text-xs text-yellow-600 mb-2">
                      Mostrando dados da última consulta em {data.lastConsultation ? new Date(data.lastConsultation).toLocaleDateString() : ''} (falha {error?.httpStatus} hoje)
                    </p>
                  )}
                  {data.lastConsultation && <p className="text-xs text-gray-400 mb-2">Última consulta: {new Date(data.lastConsultation).toLocaleDateString()}</p>}
                  <div className="space-y-3 text-sm mb-4 flex-grow">
                    <div className="flex justify-between"><span>Quantidade:</span> <span className="font-bold">{resumo?.totalSemCancelamento ?? 0}</span></div>
                    <div className="flex justify-between"><span>Valor Total:</span> <span className="font-bold">R$ 0,00</span></div>
                    {temRegistros && (
                      <div className="mt-2 text-sm">
                        <div className="font-medium">Quantos são:</div>
                        {Object.entries(resumo?.porNaturezaAgrupada || {}).map(([cod, qtd]) => (
                          <div key={cod} className="flex justify-between">
                            <span>
                              {cod === '1.3/1.7'
                                ? '1.3/1.7 = DCOMP (Declarações de Compensação)'
                                : cod === '1.2/1.6'
                                ? '1.2/1.6 = REST (Pedidos de Restituição)'
                                : cod === '1.1/1.5'
                                ? '1.1/1.5 = RESSARC (Pedidos de Ressarcimento)'
                                : cod}
                            </span>
                            <span>{qtd}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2">
                      <button className="underline text-sm" onClick={() => { setCancelCount(resumo?.canc ?? resumo?.porFamilia?.CANC ?? 0); setOpenCancel(true); }}>
                        Cancelamentos
                      </button>
                    </div>
                  </div>
                  {data.siteReceipt && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-1 text-sm">Comprovantes:</h4>
                      <div className="text-xs">
                        <a href={data.siteReceipt} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">HTML</a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {status === 'loaded' && (() => {
              const resumo = data?.perdcompResumo;
              const temRegistros = (resumo?.totalSemCancelamento ?? 0) > 0;
              return !temRegistros ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                  <p className="text-gray-500">Nenhum PER/DCOMP encontrado no período.</p>
                </div>
              ) : null;
            })()}
            {showDebug && status === 'loaded' && debug && (
              <button
                onClick={() => { setPreviewPayload({ company, debug }); setPreviewOpen(true); }}
                className="mt-2 w-full px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Ver retorno da API
              </button>
            )}
          </div>
        ))}
      </div>

      {openCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">Cancelamentos</div>
            <div>Quantidade: <strong>{cancelCount}</strong></div>
            <div className="mt-3 text-right">
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setOpenCancel(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <EnrichmentPreviewDialog
        isOpen={showEnrichPreview}
        onClose={() => { setShowEnrichPreview(false); setModalTarget(null); }}
        suggestionFlat={enrichPreview?.suggestion || null}
        rawJson={enrichPreview?.debug?.parsedJson}
        error={enrichPreview?.error ? String(enrichPreview.error) : undefined}
        onConfirm={(flat) => {
          const merged = enrichPreview?.base ? mergeEmptyFields(enrichPreview.base, flat) : flat;
          handleUseSuggestion(merged);
          setModalWarning(!enrichPreview?.suggestion);
          setShowEnrichPreview(false);
        }}
      />

      <CompetitorSearchDialog
        isOpen={compDialogOpen}
        onClose={closeCompetitorDialog}
        clientName={client?.company.Nome_da_Empresa || ''}
        limitRemaining={remainingSlots}
        fetchState={compFetch}
        onConfirm={confirmCompetitors}
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
