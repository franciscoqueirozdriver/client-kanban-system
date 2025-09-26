'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSpinner, FaInfoCircle } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal from '../../../components/NewCompanyModal';
import CompetitorSearchDialog from '../../../components/CompetitorSearchDialog';
import PerdcompApiPreviewDialog from '../../../components/PerdcompApiPreviewDialog';
import EnrichmentPreviewDialog from '../../../components/EnrichmentPreviewDialog';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import { PerdcompFamilia, MotivoNormalizado } from '@/utils/perdcomp';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

interface PerdcompAgregado {
  total: number;
  canc: number;
  totalSemCancelamento: number;
  porFamilia: Record<PerdcompFamilia, number>;
  porNatureza: Record<string, number>;
  porCredito: Record<string, number>;
  topCreditos: Array<{ codigo: string; descricao?: string; quantidade: number }>;
  porMotivo: Record<MotivoNormalizado, number>;
  cancelamentosLista: string[];
}

interface CardData {
  lastConsultation: string | null;
  siteReceipt?: string | null;
  fromCache?: boolean;
  perdcompResumo?: PerdcompAgregado;
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
  company: Company;
  data: CardData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: any;
  debug?: ApiDebug;
}

interface CompanySelection {
  company: Company;
  lastConsultation: string | null;
  forceRefresh: boolean;
}

type Prefill = { [key: string]: any };

function buildApiErrorLabel(e: any) {
  const parts: string[] = [];
  if (e?.httpStatus) {
    parts.push(`API error: ${e.httpStatus}`);
  } else {
    parts.push('API error:');
  }
  if (e?.providerCode) {
    parts.push(`– ${e.providerCode}`);
  }
  if (e?.message) {
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{ company: Company; debug: ApiDebug } | null>(null);
  const [cancelModalData, setCancelModalData] = useState<{ count: number; list: string[] } | null>(null);
  const showDebug = false;
  const q: string = initialQ;

  const updateResult = (cnpj: string, data: Partial<ComparisonResult>) => {
    const c14 = padCNPJ14(cnpj);
    setResults(prev => prev.map(r => padCNPJ14(r.company.CNPJ_Empresa) === c14 ? { ...r, ...data } : r));
  };

  const runConsultation = async (selection: CompanySelection) => {
    const { company, forceRefresh } = selection;
    const cnpj = padCNPJ14(company.CNPJ_Empresa);
    if (!isValidCNPJ(cnpj)) {
      updateResult(cnpj, { status: 'error', error: { message: 'CNPJ inválido.' } });
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
          clienteId: company.Cliente_ID,
          nomeEmpresa: company.Nome_da_Empresa,
        }),
      });
      const data = await res.json();
      if (!res.ok || (data.error && data.fonte !== 'planilha')) {
        throw data;
      }

      const lastConsultation = data.header?.requested_at || new Date().toISOString();
      const siteReceipt = data.debug?.siteReceipts?.[0] || '';
      const cardData: CardData = {
        perdcompResumo: data.perdcompResumo,
        lastConsultation,
        siteReceipt,
        fromCache: data.fonte === 'planilha',
      };
      updateResult(cnpj, { status: 'loaded', data: cardData, debug: showDebug ? data.debug : null });

    } catch (e: any) {
      updateResult(cnpj, { status: 'error', error: e });
    }
  };

  const checkLastConsultation = async (cnpj: string): Promise<string | null> => {
    try {
      const c = padCNPJ14(cnpj);
      if (!isValidCNPJ(c)) return null;
      const res = await fetch(`/api/perdecomp/verificar?cnpj=${c}`);
      if (res.ok) {
        const { lastConsultation } = await res.json();
        return lastConsultation || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to check last consultation', error);
      return null;
    }
  };

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

  const handleConsult = useCallback(async () => {
    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => ({ company: { ...s.company, CNPJ_Empresa: padCNPJ14(s.company.CNPJ_Empresa) }, data: null, status: 'idle', debug: null })));

    for (const sel of allSelections) {
      await runConsultation(sel);
      await sleep(600);
    }
    setGlobalLoading(false);
  }, [client, competitors, startDate, endDate]);

  useEffect(() => {
    if (!q) return;
    (async () => {
      try {
        const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            await handleSelectCompany('client', data[0]);
          }
        }
      } catch (err) {
        console.error('Erro ao pré-preencher busca', err);
      }
    })();
  }, [q]);

  const handleSaveNewCompany = (newCompany: Company) => {
    if (modalTarget?.type === 'competitor' && modalTarget.index !== undefined) {
      handleSelectCompany('competitor', newCompany, modalTarget.index);
    } else {
      handleSelectCompany('client', newCompany);
    }
    setCompanyModalOpen(false);
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
  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
        handleSelectCompany('competitor', {
            Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g,'').slice(0,20)}`,
            Nome_da_Empresa: s.nome,
            CNPJ_Empresa: padCNPJ14(s.cnpj),
        }, i);
      }
    }
    let currentCompetitors = next.filter(Boolean).length;
    while (currentCompetitors < MAX_COMPETITORS && idx < selected.length) {
      const s = selected[idx++];
      handleSelectCompany('competitor', {
            Cliente_ID: `COMP-${(s.cnpj || s.nome).replace(/\W+/g,'').slice(0,20)}`,
            Nome_da_Empresa: s.nome,
            CNPJ_Empresa: padCNPJ14(s.cnpj),
        }, next.length);
      next.push(null); // Placeholder for the async selection
      currentCompetitors++;
    }
    setCompDialogOpen(false);
  }

  return (
    <div className="container mx-auto p-4 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">Comparativo PER/DCOMP</h1>
      {/* --- Form Section --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="font-semibold block mb-2">Cliente Principal</label>
            <Autocomplete
              selectedCompany={client?.company ?? null}
              onSelect={(company) => handleSelectCompany('client', company)}
              onClear={() => { setClient(null); setResults([]); }}
              onNoResults={(q) => handleRegisterNewFromQuery(q, { type: 'client' })}
              initialQuery={q}
            />
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
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
            </div>
            <div>
              <label htmlFor="startDate" className="font-semibold block mb-2">Período Início</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-2">Concorrentes (até {MAX_COMPETITORS})</h3>
          {competitors.map((comp, index) => (
            <div key={index} className="mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex-grow">
                        <Autocomplete
                            selectedCompany={comp?.company ?? null}
                            onSelect={(company) => handleSelectCompany('competitor', company, index)}
                            onClear={() => handleRemoveCompetitor(index)}
                            onNoResults={(q) => handleRegisterNewFromQuery(q, { type: 'competitor', index })}
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
            {remainingSlots > 0 && <button onClick={handleAddCompetitor} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"> + Adicionar Concorrente </button>}
            <button onClick={openCompetitorDialog} disabled={!client || remainingSlots === 0} className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed"> Pesquisar Concorrentes </button>
          </div>
        </div>

        <div className="mt-8 text-center">
            <button onClick={handleConsult} disabled={globalLoading || !client} className="px-8 py-3 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 disabled:bg-gray-400 flex items-center justify-center mx-auto">
              {globalLoading && <FaSpinner className="animate-spin mr-2" />}
              {globalLoading ? 'Consultando...' : 'Consultar'}
            </button>
        </div>
      </div>

      {/* --- Results Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map(({ company, data, status, error }) => (
          <div key={company.CNPJ_Empresa} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col">
            <h3 className="font-bold text-lg truncate mb-1" title={company.Nome_da_Empresa}>{company.Nome_da_Empresa}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{padCNPJ14(company.CNPJ_Empresa)}</p>

            {data?.fromCache && (
                <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 text-xs rounded-md flex items-center gap-2">
                    <FaInfoCircle />
                    <span>Dados de {data.lastConsultation ? new Date(data.lastConsultation).toLocaleDateString() : 'consulta anterior'}.</span>
                </div>
            )}

            {status === 'loading' && <div className="flex-grow flex items-center justify-center"><FaSpinner className="animate-spin text-4xl text-violet-500"/></div>}
            {status === 'error' && <div className="flex-grow flex items-center justify-center text-red-500 text-sm text-center">{buildApiErrorLabel(error)}</div>}

            {status === 'loaded' && data && data.perdcompResumo && (() => {
              const resumo = data.perdcompResumo;
              const temRegistros = resumo.totalSemCancelamento > 0;

              if (!temRegistros) {
                return (
                  <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <p className="text-gray-500">Nenhum PER/DCOMP encontrado no período.</p>
                  </div>
                );
              }

              return (
                <div className="flex-grow flex flex-col text-sm space-y-3">
                  <div className="flex justify-between">
                    <span>Quantidade:</span>
                    <span className="font-bold">{resumo.totalSemCancelamento}</span>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="font-medium mb-1">Quantos são:</div>
                    <div className="pl-2 space-y-1">
                      {resumo.porFamilia.DCOMP > 0 && <div className="flex justify-between"><span>DCOMP:</span> <span>{resumo.porFamilia.DCOMP}</span></div>}
                      {resumo.porFamilia.REST > 0 && <div className="flex justify-between"><span>REST:</span> <span>{resumo.porFamilia.REST}</span></div>}
                      {resumo.porFamilia.RESSARC > 0 && <div className="flex justify-between"><span>RESSARC:</span> <span>{resumo.porFamilia.RESSARC}</span></div>}
                    </div>
                  </div>

                  {resumo.topCreditos.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="font-medium mb-1">Créditos mais usados:</div>
                      <div className="pl-2 space-y-1 text-xs">
                        {resumo.topCreditos.map(c => (
                          <div key={c.codigo} className="flex justify-between" title={c.descricao}>
                            <span className="truncate pr-2">{c.codigo} - {c.descricao}</span>
                            <span className="flex-shrink-0">{c.quantidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.values(resumo.porMotivo).some(v => v > 0) && (
                    <div className="pt-2 border-t">
                      <div className="font-medium mb-1">Situações (normalizadas):</div>
                      <div className="pl-2 space-y-1 text-xs">
                        {Object.entries(resumo.porMotivo).filter(([,q]) => q > 0).map(([motivo, qtd]) => (
                           <div key={motivo} className="flex justify-between">
                             <span>{motivo}:</span>
                             <span>{qtd}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <button className="underline text-sm text-blue-600 hover:text-blue-800" onClick={() => setCancelModalData({ count: resumo.canc, list: resumo.cancelamentosLista })}>
                      Cancelamentos: {resumo.canc}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* --- Modals --- */}
      <CompetitorSearchDialog
        isOpen={compDialogOpen}
        onClose={closeCompetitorDialog}
        clientName={client?.company.Nome_da_Empresa || ''}
        limitRemaining={remainingSlots}
        fetchState={compFetch}
        onConfirm={confirmCompetitors}
      />

      {cancelModalData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCancelModalData(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Cancelamentos</div>
            <div className="mb-4">Quantidade: <strong>{cancelModalData.count}</strong></div>
            {cancelModalData.list.length > 0 && (
              <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                {cancelModalData.list.map((item, i) => <div key={i}><code>{item}</code></div>)}
              </div>
            )}
            <div className="mt-4 text-right">
              <button className="px-4 py-1.5 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setCancelModalData(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <NewCompanyModal
        isOpen={companyModalOpen}
        initialData={companyPrefill || undefined}
        warning={modalWarning}
        onClose={() => setCompanyModalOpen(false)}
        onSaved={handleSaveNewCompany}
      />

    </div>
  );
}