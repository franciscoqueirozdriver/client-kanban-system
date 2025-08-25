'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal from '../../../components/NewCompanyModal';
import CompetitorSearchDialog from '../../../components/CompetitorSearchDialog';
import PerdcompApiPreviewDialog from '../../../components/PerdcompApiPreviewDialog';
import EnrichmentPreviewDialog from '../../../components/EnrichmentPreviewDialog';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';

import { Company } from '@/lib/types';

// --- Helper Types ---

interface CardData {
  lastConsultation: string | null;
  quantity: number;
  siteReceipt?: string | null;
  fromCache?: boolean;
  perdcompResumo?: any;
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
function PerdecompComparativo() {
  const searchParams = useSearchParams();
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
  const [cancelModalData, setCancelModalData] = useState<any>(null);

  // chamado pelo preview ao clicar "Usar e abrir cadastro"
  const handleUseSuggestion = (flat: Prefill) => {
    setCompanyPrefill(flat);
    setCompanyModalOpen(true);
  };

  useEffect(() => {
    if (!searchParams) return; // Add null check

    const clienteId = searchParams.get('clienteId');
    const nome = searchParams.get('nome');
    const cnpj = searchParams.get('cnpj');

    if (clienteId && nome) {
      const companyFromUrl: Company = {
        Cliente_ID: clienteId,
        Nome_da_Empresa: nome,
        CNPJ_Empresa: cnpj || '',
      };
      handleSelectCompany('client', companyFromUrl as Company & { Cliente_ID: string });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
          debug: true,
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
          const cardData: CardData = {
            quantity: data.fallback.quantidade ?? 0,
            lastConsultation: data.fallback.requested_at ?? null,
            siteReceipt: data.fallback.site_receipt ?? null,
            fromCache: true,
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
      const cardData: CardData = {
        quantity: data.perdcompResumo?.totalSemCancelamento ?? Math.max(totalPerdcomp, mappedCount),
        lastConsultation,
        siteReceipt,
        perdcompResumo: data.perdcompResumo,
      };
      updateResult(cnpj, { status: 'loaded', data: cardData, debug: data.debug ?? null });

      if (forceRefresh && (totalPerdcomp === 0 || !data.debug?.apiResponse)) {
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
    if (!client?.company?.Cliente_ID) {
      alert('Por favor, selecione ou cadastre um cliente com Cliente_ID antes de consultar.');
      return;
    }

    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null && !!c.company.Cliente_ID);
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

  async function confirmCompetitors(selected: Array<{ nome: string; cnpj: string }>) {
    const nextCompetitors = [...competitors];

    for (const item of selected) {
      const emptySlotIndex = nextCompetitors.findIndex(c => c === null);
      if (emptySlotIndex === -1 && nextCompetitors.length >= MAX_COMPETITORS) {
        break; // No more empty slots
      }

      const newCompetitor: Company = {
        Nome_da_Empresa: item.nome,
        CNPJ_Empresa: padCNPJ14(item.cnpj),
      };

      const selection: CompanySelection = {
        company: newCompetitor,
        lastConsultation: null,
        forceRefresh: false,
      };

      if (emptySlotIndex !== -1) {
        nextCompetitors[emptySlotIndex] = selection;
      } else {
        nextCompetitors.push(selection);
      }
    }
    setCompetitors(nextCompetitors);
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

      // Regra especial para CNPJ: sobrescrever se o CNPJ base for inválido e o sugerido for válido.
      if (k === 'CNPJ_Empresa') {
        const currentCnpj = padCNPJ14(cur);
        const suggestedCnpj = padCNPJ14(val);

        if (isValidCNPJ(suggestedCnpj) && !isValidCNPJ(currentCnpj)) {
          out[k] = val; // Sobrescreve o CNPJ inválido
        } else if (!cur && val) {
          out[k] = val; // Preenche se estiver vazio
        }
      } else {
        // Lógica original para os outros campos: preencher apenas se estiverem vazios.
        if (!cur && val) {
          out[k] = val;
        }
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

  const handleSelectCompany = async (type: 'client' | 'competitor', company: Company & { Cliente_ID: string }, index?: number) => {
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

  const handleSaveNewCompany = (newCompany: Company & { Cliente_ID: string }) => {
    if (modalTarget?.type === 'competitor' && modalTarget.index !== undefined) {
      handleSelectCompany('competitor', newCompany, modalTarget.index);
    } else {
      handleSelectCompany('client', newCompany);
    }
    setCompanyModalOpen(false);
    setCompanyPrefill(null);
    setModalTarget(null);
  };

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
            {status === 'loaded' && data && (
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
                  <div className="flex items-center justify-between">
                    <span>Quantidade:</span>
                    <strong>{data.perdcompResumo?.totalSemCancelamento ?? data.quantity ?? 0}</strong>
                  </div>

                  {data.perdcompResumo && (
                    <div className="mt-2 text-sm">
                      <div className="font-medium">Quantos são:</div>
                      <div className="flex justify-between">
                        <span>1.3 = DCOMP (compensações)</span>
                        <span>{data.perdcompResumo.dcomp ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1.2 = REST (restituições)</span>
                        <span>{data.perdcompResumo.rest ?? 0}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between"><span>Valor Total:</span> <span className="font-bold">R$ 0,00</span></div>

                  {data.perdcompResumo?.canc > 0 && (
                    <div className="mt-2">
                      <button className="underline text-sm text-blue-500 hover:text-blue-700" onClick={() => setCancelModalData(data.perdcompResumo)}>
                        Cancelamentos
                      </button>
                    </div>
                  )}
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
            )}
            {status === 'loaded' && !data?.quantity && (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <p className="text-gray-500">Nenhum PER/DCOMP encontrado no período.</p>
              </div>
            )}
            {status === 'loaded' && debug && (
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

      <PerdcompApiPreviewDialog
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        company={previewPayload?.company || null}
        debug={previewPayload?.debug || null}
      />

      {cancelModalData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 w-full max-w-md shadow-lg">
            <div className="text-lg font-semibold mb-2">Cancelamentos</div>
            <div>Quantidade: <strong>{cancelModalData.canc ?? 0}</strong></div>
            <div className="mt-3 text-right">
              <button className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={() => setCancelModalData(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap the component in Suspense to handle the client-side hooks like useSearchParams
export default function PerdecompComparativoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PerdecompComparativo />
    </Suspense>
  );
}
