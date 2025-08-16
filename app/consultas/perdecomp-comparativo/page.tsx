'use client';

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import Autocomplete from '../../../components/Perdecomp/Autocomplete';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

interface PerdcompRow {
  // Mirrors the 18-column structure
  Cliente_ID: string;
  'Nome da Empresa': string;
  Perdcomp_ID: string;
  CNPJ: string;
  Tipo_Pedido: string;
  Situacao: string;
  Periodo_Inicio: string;
  Periodo_Fim: string;
  Valor_Total: number;
  Numero_Processo: string;
  Data_Protocolo: string;
  Ultima_Atualizacao: string;
  Quantidade_Receitas: number;
  Quantidade_Origens: number;
  Quantidade_DARFs: number;
  URL_Comprovante_HTML: string;
  URL_Comprovante_PDF: string;
  Data_Consulta: string;
}

interface AggregatedData {
  totalCount: number;
  totalValue: number;
  valueByType: { [key: string]: number };
  comprovantes: { html: string; pdf: string; id: string }[];
  lastConsultation: string | null;
}

interface ComparisonResult {
  company: Company;
  data: AggregatedData | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: string;
}

// --- Helper Functions ---
const aggregatePerdcompData = (rows: PerdcompRow[], startDate: string, endDate: string): AggregatedData => {
  const filteredRows = rows.filter(row => {
    // This basic filter assumes YYYY-MM-DD format.
    const rowDate = row.Periodo_Fim || row.Data_Consulta.split('T')[0];
    return rowDate >= startDate && rowDate <= endDate;
  });

  if (filteredRows.length === 0) {
    const lastConsultation = rows.length > 0 ? rows.sort((a, b) => new Date(b.Data_Consulta).getTime() - new Date(a.Data_Consulta).getTime())[0].Data_Consulta : null;
    return {
      totalCount: 0,
      totalValue: 0,
      valueByType: {},
      comprovantes: [],
      lastConsultation
    };
  }

  const valueByType = filteredRows.reduce((acc, row) => {
    const value = Number(row.Valor_Total) || 0;
    acc[row.Tipo_Pedido] = (acc[row.Tipo_Pedido] || 0) + value;
    return acc;
  }, {} as { [key: string]: number });

  const totalValue = Object.values(valueByType).reduce((sum, v) => sum + v, 0);

  const comprovantes = filteredRows
    .filter(row => row.URL_Comprovante_HTML || row.URL_Comprovante_PDF)
    .map(row => ({
      html: row.URL_Comprovante_HTML,
      pdf: row.URL_Comprovante_PDF,
      id: row.Perdcomp_ID,
    }));

  const lastConsultation = filteredRows.sort((a, b) => new Date(b.Data_Consulta).getTime() - new Date(a.Data_Consulta).getTime())[0].Data_Consulta;

  return {
    totalCount: filteredRows.length,
    totalValue,
    valueByType,
    comprovantes,
    lastConsultation
  };
};

// --- Main Page Component ---
export default function PerdecompComparativoPage() {
  const [client, setClient] = useState<Company | null>(null);
  const [competitors, setCompetitors] = useState<Array<Company | null>>([]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  });
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    'Nome da Empresa': '',
    'CNPJ Empresa': '',
    'Site Empresa': '',
    'País Empresa': 'Brasil',
    'Estado Empresa': '',
    'Cidade Empresa': '',
    'Logradouro Empresa': '',
    'Numero Empresa': '',
    'Bairro Empresa': '',
    'Complemento Empresa': '',
    'CEP Empresa': '',
    'DDI Empresa': '+55',
    'Telefones Empresa': '',
    'Observação Empresa': '',
  });

  useEffect(() => {
    const end = new Date(endDate);
    end.setFullYear(end.getFullYear() - 5);
    setStartDate(end.toISOString().split('T')[0]);
  }, [endDate]);

  const updateResult = (cnpj: string, data: Partial<ComparisonResult>) => {
    setResults(prev => prev.map(r => r.company.CNPJ_Empresa === cnpj ? { ...r, ...data } : r));
  };

  const runConsultation = async (company: Company, force = false) => {
    updateResult(company.CNPJ_Empresa, { status: 'loading' });
    try {
      const res = await fetch('/api/infosimples/perdcomp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: company.CNPJ_Empresa,
          periodoInicio: startDate,
          periodoFim: endDate,
          force,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data = await res.json();

      let finalData: PerdcompRow[] = [];
      if (data.fonte === 'api') {
        if (data.itens && data.itens.length > 0) {
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
        }
      } else {
        finalData = data.linhas;
      }

      const aggregated = aggregatePerdcompData(finalData, startDate, endDate);
      updateResult(company.CNPJ_Empresa, { status: 'loaded', data: aggregated });

    } catch (e: any) {
      updateResult(company.CNPJ_Empresa, { status: 'error', error: e.message });
    }
  };

  const handleConsult = async () => {
    const allCompanies = [client, ...competitors].filter((c): c is Company => c !== null);
    if (allCompanies.length === 0) return;

    setGlobalLoading(true);
    setResults(allCompanies.map(c => ({ company: c, data: null, status: 'idle' })));

    await Promise.all(allCompanies.map(c => runConsultation(c, false)));

    setGlobalLoading(false);
  };

  const handleForceConsult = async (company: Company) => {
    setGlobalLoading(true);
    await runConsultation(company, true);
    setGlobalLoading(false);
  };

  const handleAddCompetitor = () => {
    if (competitors.length < 3) setCompetitors([...competitors, null]);
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewClientForm(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add validation
    try {
      const res = await fetch('/api/clientes/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClientForm),
      });
      if (res.ok) {
        const { newClient } = await res.json();
        alert('Cliente cadastrado com sucesso!');
        setShowRegisterModal(false);
        // Select the new client automatically
        setClient({
            Cliente_ID: newClient.Cliente_ID,
            Nome_da_Empresa: newClient['Nome da Empresa'],
            CNPJ_Empresa: newClient['CNPJ Empresa'],
        });
      } else {
        const { message } = await res.json();
        alert(`Erro: ${message}`);
      }
    } catch (error) {
      alert('Falha ao cadastrar cliente.');
    }
  };

  const handleEnrich = async () => {
    if (!client) return;

    setGlobalLoading(true);
    try {
      const res = await fetch('/api/enriquecer-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Cliente_ID: client.Cliente_ID,
          nome: client.Nome_da_Empresa,
          overwrite: true,
        }),
      });

      if (res.ok) {
        alert('Dados enriquecidos com sucesso! A atualização pode levar alguns instantes para refletir na busca.');
      } else {
        const { error } = await res.json();
        alert(`Erro ao enriquecer: ${error}`);
      }
    } catch (error) {
      alert('Falha ao enriquecer dados.');
    }
    setGlobalLoading(false);
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
                <Autocomplete selectedCompany={client} onSelect={setClient} onClear={() => setClient(null)} onNoResults={() => setShowRegisterModal(true)}/>
              </div>
              <button
                onClick={handleEnrich}
                disabled={!client || globalLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed h-10"
                title="Enriquecer Dados do Cadastro"
              >
                Enriquecer
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="endDate" className="font-semibold block mb-2">Período Fim</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
            </div>
            <div>
              <label htmlFor="startDate" className="font-semibold block mb-2">Período Início (auto)</label>
              <input type="date" id="startDate" value={startDate} readOnly className="w-full p-2 border rounded bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-600 cursor-not-allowed" />
            </div>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Concorrentes (até 3)</h3>
          {competitors.map((comp, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <div className="flex-grow">
                <Autocomplete selectedCompany={comp} onSelect={(s) => setCompetitors(c => c.map((i, idx) => idx === index ? s : i))} onClear={() => setCompetitors(c => c.map((i, idx) => idx === index ? null : i))} />
              </div>
              <button onClick={() => handleRemoveCompetitor(index)} className="text-red-500 hover:text-red-700 font-bold p-2">X</button>
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

                {Object.keys(data.valueByType).length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1 text-sm">Valor por Tipo:</h4>
                    <div className="text-xs space-y-1">
                      {Object.entries(data.valueByType).map(([tipo, valor]) => (
                        <div key={tipo} className="flex justify-between"><span>{tipo}:</span> <span>{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      ))}
                    </div>
                  </div>
                )}

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

                <button onClick={() => handleForceConsult(company)} className="mt-auto w-full px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                  Fazer Nova Consulta
                </button>
              </div>
            )}
             {status === 'loaded' && !data?.totalCount && (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <p className="text-gray-500">Nenhum PER/DCOMP encontrado no período.</p>
                     <button onClick={() => handleForceConsult(company)} className="mt-4 w-full px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                      Tentar Nova Consulta
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>

      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6">Cadastrar Nova Empresa</h2>
            <p className="mb-4">Preencha os dados abaixo para cadastrar uma nova empresa.</p>
            <form onSubmit={handleRegisterSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                    <input name="Nome da Empresa" placeholder="Nome da Empresa *" value={newClientForm['Nome da Empresa']} onChange={handleFormChange} required className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="CNPJ Empresa" placeholder="CNPJ Empresa *" value={newClientForm['CNPJ Empresa']} onChange={handleFormChange} required className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Site Empresa" placeholder="Site Empresa" value={newClientForm['Site Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="País Empresa" placeholder="País Empresa" value={newClientForm['País Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Estado Empresa" placeholder="Estado Empresa" value={newClientForm['Estado Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Cidade Empresa" placeholder="Cidade Empresa" value={newClientForm['Cidade Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Logradouro Empresa" placeholder="Logradouro Empresa" value={newClientForm['Logradouro Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Numero Empresa" placeholder="Numero Empresa" value={newClientForm['Numero Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Bairro Empresa" placeholder="Bairro Empresa" value={newClientForm['Bairro Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Complemento Empresa" placeholder="Complemento Empresa" value={newClientForm['Complemento Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="CEP Empresa" placeholder="CEP Empresa" value={newClientForm['CEP Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="DDI Empresa" placeholder="DDI Empresa" value={newClientForm['DDI Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <input name="Telefones Empresa" placeholder="Telefones Empresa" value={newClientForm['Telefones Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
                    <textarea name="Observação Empresa" placeholder="Observação Empresa" value={newClientForm['Observação Empresa']} onChange={handleFormChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2" />
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button type="button" onClick={() => setShowRegisterModal(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700">Salvar</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
