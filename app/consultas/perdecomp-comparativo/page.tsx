'use client';

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';
import NewCompanyModal, { FullCompanyPayload } from '../../../components/NewCompanyModal';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

interface PerdcompRow {
  Cliente_ID: string; 'Nome da Empresa': string; Perdcomp_ID: string; CNPJ: string;
  Tipo_Pedido: string; Situacao: string; Periodo_Inicio: string; Periodo_Fim: string;
  Valor_Total: number; Numero_Processo: string; Data_Protocolo: string; Ultima_Atualizacao: string;
  Quantidade_Receitas: number; Quantidade_Origens: number; Quantidade_DARFs: number;
  URL_Comprovante_HTML: string; URL_Comprovante_PDF: string; Data_Consulta: string;
}

interface AggregatedData {
  totalCount: number; totalValue: number;
  valueByType: { [key: string]: number };
  comprovantes: { html: string; pdf: string; id: string }[];
  lastConsultation: string | null;
}

interface ComparisonResult {
  company: Company; data: AggregatedData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error'; error?: string;
}

interface CompanySelection {
  company: Company; lastConsultation: string | null; forceRefresh: boolean;
}

// --- Helper Functions ---
const aggregatePerdcompData = (rows: PerdcompRow[], startDate: string, endDate: string): AggregatedData => {
  const filteredRows = rows.filter(row => {
    const rowDate = row.Periodo_Fim || row.Data_Consulta.split('T')[0];
    return rowDate >= startDate && rowDate <= endDate;
  });

  if (filteredRows.length === 0) {
    const lastConsultation = rows.length > 0 ? rows.sort((a, b) => new Date(b.Data_Consulta).getTime() - new Date(a.Data_Consulta).getTime())[0].Data_Consulta : null;
    return { totalCount: 0, totalValue: 0, valueByType: {}, comprovantes: [], lastConsultation };
  }

  const valueByType = filteredRows.reduce((acc, row) => {
    const value = Number(row.Valor_Total) || 0;
    acc[row.Tipo_Pedido] = (acc[row.Tipo_Pedido] || 0) + value;
    return acc;
  }, {} as { [key: string]: number });

  const totalValue = Object.values(valueByType).reduce((sum, v) => sum + v, 0);
  const comprovantes = filteredRows.filter(row => row.URL_Comprovante_HTML || row.URL_Comprovante_PDF).map(row => ({
    html: row.URL_Comprovante_HTML, pdf: row.URL_Comprovante_PDF, id: row.Perdcomp_ID,
  }));
  const lastConsultation = filteredRows.sort((a, b) => new Date(b.Data_Consulta).getTime() - new Date(a.Data_Consulta).getTime())[0].Data_Consulta;

  return { totalCount: filteredRows.length, totalValue, valueByType, comprovantes, lastConsultation };
};

// --- Main Page Component ---
export default function PerdecompComparativoPage() {
  const [client, setClient] = useState<CompanySelection | null>(null);
  const [competitors, setCompetitors] = useState<Array<CompanySelection | null>>([]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  });
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [modalData, setModalData] = useState<Partial<FullCompanyPayload> | undefined>();
  const [isDateAutomationEnabled, setIsDateAutomationEnabled] = useState(true);

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
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data = await res.json();

      let finalData: PerdcompRow[] = [];
      if (data.fonte === 'api' && data.itens?.length > 0) {
          const preparedForSave = data.itens.map((item: Omit<PerdcompRow, 'Cliente_ID' | 'Nome da Empresa'>) => ({
            ...item,
            Cliente_ID: company.Cliente_ID,
            "Nome da Empresa": company.Nome_da_Empresa,
          }));
          await fetch('/api/perdecomp/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linhas: preparedForSave }),
          });
          finalData = preparedForSave;
      } else {
        finalData = data.linhas || [];
      }

      const aggregated = aggregatePerdcompData(finalData, startDate, endDate);
      updateResult(company.CNPJ_Empresa, { status: 'loaded', data: aggregated });

    } catch (e: any) {
      updateResult(company.CNPJ_Empresa, { status: 'error', error: e.message });
    }
  };

  const handleConsult = async () => {
    const allSelections = [client, ...competitors].filter((c): c is CompanySelection => c !== null);
    if (allSelections.length === 0) return;

    setGlobalLoading(true);
    setResults(allSelections.map(s => ({ company: s.company, data: null, status: 'idle' })));
    await Promise.all(allSelections.map(s => runConsultation(s)));
    setGlobalLoading(false);
  };

  const handleAddCompetitor = () => {
    if (competitors.length < 3) setCompetitors([...competitors, null]);
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleCompetitorChange = (index: number, data: Partial<CompanySelection>) => {
    setCompetitors(prev => prev.map((c, i) => i === index ? { ...c!, ...data } : c));
  };

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
    handleSelectCompany('client', newCompany);
    setShowRegisterModal(false);
  };

  async function fetchEnrichmentData(nome: string): Promise<Partial<FullCompanyPayload>> {
    const res = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Falha ao enriquecer dados.');
    }
    const data = await res.json();
    const suggestion = data.suggestion || {};
    return {
        Empresa: {
            Nome_da_Empresa: suggestion.Nome_da_Empresa || nome, Site_Empresa: suggestion.Site_Empresa || '', País_Empresa: suggestion.Pais_Empresa || 'Brasil',
            Estado_Empresa: suggestion.Estado_Empresa || '', Cidade_Empresa: suggestion.Cidade_Empresa || '', Logradouro_Empresa: suggestion.Logradouro_Empresa || '',
            Numero_Empresa: suggestion.Numero_Empresa || '', Bairro_Empresa: suggestion.Bairro_Empresa || '', Complemento_Empresa: suggestion.Complemento_Empresa || '',
            CEP_Empresa: suggestion.CEP_Empresa || '', CNPJ_Empresa: suggestion.CNPJ_Empresa || '', DDI_Empresa: suggestion.DDI_Empresa || '+55',
            Telefones_Empresa: suggestion.Telefones_Empresa || '', Observacao_Empresa: suggestion.Observacao_Empresa || '',
        },
        Contato: {
            Nome_Contato: suggestion.Nome_Contato || '', Email_Contato: suggestion.Email_Contato || '', Cargo_Contato: suggestion.Cargo_Contato || '',
            DDI_Contato: suggestion.DDI_Contato || '+55', Telefones_Contato: suggestion.Telefones_Contato || '',
        },
        Comercial: {
            Mercado: suggestion.Mercado || '', Produto: suggestion.Produto || '', Área: suggestion.Area || '',
            Origem: 'Cadastro Manual', Sub_Origem: 'Modal PER/DCOMP', Etapa: 'Novo', Funil: 'Padrão', Tipo_do_Serv_Comunicacao: '', ID_do_Serv_Comunicacao: '',
        }
    };
  }

  const handleOpenRegisterModal = async (query: string) => {
    setGlobalLoading(true);
    try {
        const enrichedData = await fetchEnrichmentData(query);
        setModalData(enrichedData);
        setShowRegisterModal(true);
    } catch (error: any) {
        alert(`Erro ao buscar dados para nova empresa: ${error.message}`);
        setModalData({ Empresa: { Nome_da_Empresa: query } as any });
        setShowRegisterModal(true);
    } finally {
        setGlobalLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!client) return;
    setGlobalLoading(true);
    try {
        const enrichedData = await fetchEnrichmentData(client.company.Nome_da_Empresa);
        enrichedData.Cliente_ID = client.company.Cliente_ID;
        setModalData(enrichedData);
        setShowRegisterModal(true);
    } catch (error: any) {
        alert(`Erro ao enriquecer dados do cliente: ${error.message}`);
    } finally {
        setGlobalLoading(false);
    }
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
                  onNoResults={handleOpenRegisterModal}
                />
              </div>
              <button
                onClick={handleEnrich}
                disabled={!client || !!client.company.CNPJ_Empresa || globalLoading}
                className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed h-10"
                title="Enriquecer dados do cliente (apenas para cadastros sem CNPJ)"
              >
                {globalLoading ? <FaSpinner className="animate-spin" /> : 'Enriquecer'}
              </button>
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
                  <Autocomplete selectedCompany={comp?.company ?? null} onSelect={(company) => handleSelectCompany('competitor', company, index)} onClear={() => handleRemoveCompetitor(index)} />
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
          <button
            onClick={handleAddCompetitor}
            disabled={competitors.length >= 3}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            + Adicionar Concorrente
          </button>
        </div>
        <div className="mt-8 text-center">
            <button onClick={handleConsult} disabled={globalLoading || !client} className="px-8 py-3 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto">
              {globalLoading && <FaSpinner className="animate-spin mr-2" />}
              {globalLoading ? 'Consultando...' : 'Consultar / Atualizar Comparação'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map(({ company, data, status, error }) => (
          <div key={company.CNPJ_Empresa} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col">
            <h3 className="font-bold text-lg truncate mb-1" title={company.Nome_da_Empresa}>{company.Nome_da_Empresa}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{company.CNPJ_Empresa}</p>

            {status === 'loading' && <div className="flex-grow flex items-center justify-center"><FaSpinner className="animate-spin text-4xl text-violet-500"/></div>}
            {status === 'error' && <div className="flex-grow flex items-center justify-center text-red-500">{error}</div>}
            {status === 'loaded' && data && (
              <div className="flex-grow flex flex-col">
                {data.lastConsultation && <p className="text-xs text-gray-400 mb-2">Última consulta: {new Date(data.lastConsultation).toLocaleDateString()}</p>}
                <div className="space-y-3 text-sm mb-4 flex-grow">
                  <div className="flex justify-between"><span>Quantidade:</span> <span className="font-bold">{data.totalCount}</span></div>
                  <div className="flex justify-between"><span>Valor Total:</span> <span className="font-bold">{data.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
                {data.comprovantes.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1 text-sm">Comprovantes:</h4>
                    <div className="text-xs space-y-1 max-h-24 overflow-y-auto">
                      {data.comprovantes.map(c => (
                        <div key={c.id} className="flex gap-2">
                           {c.html && <a href={c.html} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">HTML</a>}
                           {c.pdf && <a href={c.pdf} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">PDF</a>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
             {status === 'loaded' && !data?.totalCount && (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <p className="text-gray-500">Nenhum PER/DCOMP encontrado no período.</p>
                </div>
            )}
          </div>
        ))}
      </div>

      <NewCompanyModal
        isOpen={showRegisterModal}
        initialData={modalData}
        onClose={() => setShowRegisterModal(false)}
        onSaved={handleSaveNewCompany}
      />
    </div>
  );
}
