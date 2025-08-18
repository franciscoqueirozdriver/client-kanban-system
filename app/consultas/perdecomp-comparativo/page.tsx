'use client';

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal from '../../../components/NewCompanyModal';
import CompetitorSearchDialog from '../../../components/CompetitorSearchDialog';
import PerdcompApiPreviewDialog from '../../../components/PerdcompApiPreviewDialog';
import EnrichmentPreviewDialog from '../../../components/EnrichmentPreviewDialog';
import { isValidCNPJ } from '../../../lib/isValidCNPJ';

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
  status: 'idle' | 'loading' | 'loaded' | 'error'; error?: string;
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
// --- Main Page Component ---
export default function PerdecompComparativoPage() {
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
    setResults(prev => prev.map(r => r.company.CNPJ_Empresa === cnpj ? { ...r, ...data } : r));
  };

  const runConsultation = async (selection: CompanySelection) => {
    const { company, forceRefresh } = selection;
    if (!isValidCNPJ(company.CNPJ_Empresa)) {
      updateResult(company.CNPJ_Empresa, { status: 'error', error: 'CNPJ inválido. Verifique e tente novamente.' });
      return;
    }
    updateResult(company.CNPJ_Empresa, { status: 'loading' });
    try {
      const res = await fetch('/api/infosimples/perdcomp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: company.CNPJ_Empresa,
          periodoInicio: startDate,
          periodoFim: endDate,
          force: forceRefresh,
          debug: true,
          clienteId: company.Cliente_ID,
          nomeEmpresa: company.Nome_da_Empresa,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `API error: ${res.statusText}`);
      }

      const mappedCount = data.debug?.mappedCount || (data.linhas ? data.linhas.length : 0);
      const totalPerdcomp = data.debug?.total_perdcomp || 0;
      const siteReceipt = data.debug?.siteReceipts?.[0] || data.linhas?.[0]?.URL_Comprovante_HTML || null;
      const lastConsultation = data.debug?.header?.requested_at || data.linhas?.[0]?.Data_Consulta || null;
      const cardData: CardData = {
        quantity: Math.max(totalPerdcomp, mappedCount),
        lastConsultation,
        siteReceipt,
      };
      updateResult(company.CNPJ_Empresa, { status: 'loaded', data: cardData, debug: data.debug ?? null });

      if (forceRefresh && (totalPerdcomp === 0 || !data.debug?.apiResponse)) {
        setPreviewPayload({ company, debug: data.debug ?? null });
        setPreviewOpen(true);
      }

    } catch (e: any) {
      updateResult(company.CNPJ_Empresa, { status: 'error', error: e.message });
    }
  };

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const handleConsult = async () => {
    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => ({ company: s.company, data: null, status: 'idle', debug: null })));

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
      const selCnpjs = new Set(competitors.filter(Boolean).map(c => (c!.company.CNPJ_Empresa || '').replace(/\D/g, '')));
      const clientCnpj = (client.company.CNPJ_Empresa || '').replace(/\D/g, '');

      const items = (data.items || []).filter((it: any) => {
        const c = (it?.cnpj || '').replace(/\D/g, '');
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
            CNPJ_Empresa: s.cnpj || '',
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
          CNPJ_Empresa: s.cnpj || '',
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
      const res = await fetch(`/api/perdecomp/verificar?cnpj=${cnpj}`);
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
      if (!cur && val) out[k] = val;
    });
    return out;
  }

  function openNewCompanyModal(opts: { initialData: any; warning?: boolean; target: { type: 'client' | 'competitor'; index?: number } }) {
    setCompanyPrefill(opts.initialData);
    setModalWarning(!!opts.warning);
    setModalTarget(opts.target);
    setCompanyModalOpen(true);
  }

  async function handleRegisterNewFromQuery(query: string) {
    setIsEnriching(true);
    setEnrichTarget('client');
    try {
      const r = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: query })
      });
      const { suggestion } = await r.json();
      openNewCompanyModal({ initialData: suggestion ?? { Nome_da_Empresa: query }, warning: !suggestion, target: { type: 'client' } });
    } catch {
      openNewCompanyModal({ initialData: { Nome_da_Empresa: query }, warning: true, target: { type: 'client' } });
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
      cnpj = (selectedCompany.CNPJ_Empresa || '').replace(/\D/g, '');
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
    const lastConsultation = await checkLastConsultation(company.CNPJ_Empresa);
    const selection: CompanySelection = { company, lastConsultation, forceRefresh: false };
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
                  onNoResults={handleRegisterNewFromQuery}
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
                  <Autocomplete selectedCompany={comp?.company ?? null} onSelect={(company) => handleSelectCompany('competitor', company, index)} onClear={() => handleRemoveCompetitor(index)} onEnrichSelected={(company) => handleEnrichFromMain('selected', company, undefined, { type: 'competitor', index })} isEnriching={isEnriching && enrichTarget === `competitor-${index}`} />
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{company.CNPJ_Empresa}</p>

            {status === 'loading' && <div className="flex-grow flex items-center justify-center"><FaSpinner className="animate-spin text-4xl text-violet-500"/></div>}
            {status === 'error' && <div className="flex-grow flex items-center justify-center text-red-500">{error}</div>}
            {status === 'loaded' && data && (
              <div className="flex-grow flex flex-col">
                {data.lastConsultation && <p className="text-xs text-gray-400 mb-2">Última consulta: {new Date(data.lastConsultation).toLocaleDateString()}</p>}
                <div className="space-y-3 text-sm mb-4 flex-grow">
                  <div className="flex justify-between"><span>Quantidade:</span> <span className="font-bold">{data.quantity}</span></div>
                  <div className="flex justify-between"><span>Valor Total:</span> <span className="font-bold">R$ 0,00</span></div>
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
    </div>
  );
}
