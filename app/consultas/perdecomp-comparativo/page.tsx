'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaDownload, FaSpinner } from 'react-icons/fa';

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
const isValidCnpj = (cnpj: string | null | undefined): boolean => {
  if (!cnpj) return false;

  const cnpjClean = cnpj.replace(/[^\d]/g, '');

  if (cnpjClean.length !== 14 || /^(\d)\1+$/.test(cnpjClean)) {
    return false;
  }

  let size = 12;
  let sum = 0;
  let pos = 5;

  for (let i = 0; i < size; i++) {
    sum += parseInt(cnpjClean[i]) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(cnpjClean[12])) {
    return false;
  }

  size = 13;
  sum = 0;
  pos = 6;
  for (let i = 0; i < size; i++) {
    sum += parseInt(cnpjClean[i]) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(cnpjClean[13])) {
    return false;
  }

  return true;
};

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


// --- Autocomplete Component ---
interface AutocompleteProps {
  selectedCompany: Company | null;
  onSelect: (company: Company) => void;
  onClear: () => void;
  onForceChange: (isForced: boolean) => void;
  onRegisterNew: () => void;
  onEnrichRequest: () => void;
  placeholder?: string;
}

const Autocomplete = ({ selectedCompany, onSelect, onClear, onForceChange, onRegisterNew, onEnrichRequest, placeholder = "Digite o Nome ou CNPJ" }: AutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConsultation, setLastConsultation] = useState<string | null>(null);
  const [forceNew, setForceNew] = useState(false);

  useEffect(() => {
    const isCnpjLike = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(query);

    if (isCnpjLike && !isValidCnpj(query)) {
      setError("CNPJ inválido.");
      setResults([]);
      return;
    }

    setError(null);
    if (query.length < 3 && !isCnpjLike) {
      setResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsLoading(true);
      const searchQuery = isCnpjLike ? query.replace(/[^\d]/g, '') : query;
      try {
        const response = await fetch(`/api/clientes/buscar?q=${searchQuery}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch (error) {
        console.error("Failed to fetch companies", error);
      }
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(debounce);
  }, [query]);

  useEffect(() => {
    if (selectedCompany && isValidCnpj(selectedCompany.CNPJ_Empresa)) {
      const checkConsultation = async () => {
        const res = await fetch(`/api/perdecomp/verificar?cnpj=${selectedCompany.CNPJ_Empresa}`);
        if (res.ok) {
          const data = await res.json();
          setLastConsultation(data.lastConsultation);
        }
      };
      checkConsultation();
    } else {
      setLastConsultation(null);
    }
  }, [selectedCompany]);

  const handleForceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setForceNew(isChecked);
    onForceChange(isChecked);
  };

  const extendedOnClear = () => {
    setLastConsultation(null);
    setForceNew(false);
    onForceChange(false); // Notify parent that force is off
    onClear();
  };

  const handleSelect = (company: Company) => {
    setQuery('');
    setResults([]);
    setShowSuggestions(false);
    onSelect(company);
  };

  if (selectedCompany) {
    return (
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
        <div className="flex items-start justify-between">
            <div className="flex-grow truncate">
                <p className="font-semibold text-sm truncate" title={selectedCompany.Nome_da_Empresa}>{selectedCompany.Nome_da_Empresa}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCompany.CNPJ_Empresa}</p>
            </div>
            <button onClick={extendedOnClear} className="ml-2 text-red-500 hover:text-red-700 font-bold p-1">X</button>
        </div>
        {lastConsultation && isValidCnpj(selectedCompany.CNPJ_Empresa) && (
            <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Consulta recente em: {new Date(lastConsultation).toLocaleDateString()}</p>
                <label className="flex items-center mt-1 text-xs">
                    <input type="checkbox" checked={forceNew} onChange={handleForceChange} className="mr-2 h-4 w-4" />
                    Forçar nova consulta
                </label>
            </div>
        )}
        {!isValidCnpj(selectedCompany.CNPJ_Empresa) && (
            <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                 <button onClick={onEnrichRequest} className="w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                    Enriquecer Lead (sem CNPJ)
                </button>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-10">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {showSuggestions && !error && (query.length >= 3 || isValidCnpj(query)) && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading && <li className="p-2 text-gray-500">Buscando...</li>}
          {!isLoading && results.length === 0 && (
            <li className="p-2 text-center">
              <p className="text-gray-500 text-sm mb-2">Nenhum resultado.</p>
              <button onClick={onRegisterNew} className="w-full px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Cadastrar Nova Empresa
              </button>
            </li>
          )}
          {results.map((company) => (
            <li key={company.Cliente_ID} onMouseDown={() => handleSelect(company)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              {company.Nome_da_Empresa} <span className="text-sm text-gray-500">{company.CNPJ_Empresa}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- New Company Modal Component ---
interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (company: Company) => void;
  initialData?: Partial<Company> | null;
}

const NewCompanyModal = ({ isOpen, onClose, onSaveSuccess, initialData }: NewCompanyModalProps) => {
  const [formData, setFormData] = useState<Partial<Company>>({});
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({}); // Reset for new entry
    }
  }, [initialData, isOpen]); // Depend on isOpen to reset when modal re-opens

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEnrich = async () => {
    if (!formData['Nome da Empresa']) {
      alert('Por favor, insira o Nome da Empresa para enriquecer os dados.');
      return;
    }
    setIsEnriching(true);
    try {
      // This API route seems to be in the `pages` dir based on the initial file listing
      const res = await fetch('/api/enriquecer-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: { nome: formData['Nome da Empresa'] } }),
      });
      if (res.ok) {
        const enrichedData = await res.json();
        setFormData(prev => {
            const newFormData = { ...prev };
            const mapping = {
                'Site': enrichedData.site,
                'País': enrichedData.pais,
                'Estado': enrichedData.estado,
                'Cidade': enrichedData.cidade,
                'Logradouro': enrichedData.logradouro,
                'Número': enrichedData.numero,
                'Bairro': enrichedData.bairro,
                'Complemento': enrichedData.complemento,
                'CEP': enrichedData.cep,
                'CPF/CNPJ': enrichedData.cnpj,
                'DDI': enrichedData.ddi,
                'Telefones': enrichedData.telefone,
                'Observação': enrichedData.observacao,
                'Nome da Empresa': enrichedData.nome,
            };
            for (const [key, value] of Object.entries(mapping)) {
                if (value) {
                    newFormData[key] = value;
                }
            }
            return newFormData;
        });
      } else {
        alert('Falha ao enriquecer dados.');
      }
    } catch (error) {
      alert('Erro ao conectar com o serviço de enriquecimento.');
    }
    setIsEnriching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let res;
      if (isEditMode) {
        // Update existing lead
        res = await fetch('/api/clientes/atualizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetName: initialData?._sourceSheet,
            rowNumber: initialData?._rowNumber,
            data: formData,
          }),
        });
      } else {
        // Create new company
        res = await fetch('/api/clientes/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (res.ok) {
        const result = await res.json();
        // For updates, the result is just a success message. For saves, it's the new company data.
        // We pass the formData which is the most up-to-date version.
        const finalCompanyData = isEditMode ? { ...initialData, ...formData } : result.data;
        onSaveSuccess(finalCompanyData);
        setFormData({}); // Reset form
        onClose();
      } else {
        const errorData = await res.json();
        alert(`Falha ao salvar: ${errorData.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      alert('Erro de conexão ao salvar a empresa.');
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">{isEditMode ? 'Atualizar / Enriquecer Lead' : 'Cadastrar Nova Empresa'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Define a base style for inputs to avoid repetition */}
            <input name="Cliente_ID" value={formData['Cliente_ID'] || ''} onChange={handleInputChange} placeholder="Cliente_ID" className="p-2 border rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-400" readOnly />
            <input name="Nome do Lead" value={formData['Nome do Lead'] || ''} onChange={handleInputChange} placeholder="Nome do Lead *" required className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Origem" value={formData['Origem'] || ''} onChange={handleInputChange} placeholder="Origem" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Sub-Origem" value={formData['Sub-Origem'] || ''} onChange={handleInputChange} placeholder="Sub-Origem" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Mercado" value={formData['Mercado'] || ''} onChange={handleInputChange} placeholder="Mercado" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Produto" value={formData['Produto'] || ''} onChange={handleInputChange} placeholder="Produto" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Site" value={formData['Site'] || ''} onChange={handleInputChange} placeholder="Site" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="País" value={formData['País'] || ''} onChange={handleInputChange} placeholder="País" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Estado" value={formData['Estado'] || ''} onChange={handleInputChange} placeholder="Estado" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Cidade" value={formData['Cidade'] || ''} onChange={handleInputChange} placeholder="Cidade" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />

            <input name="Logradouro" value={formData['Logradouro'] || ''} onChange={handleInputChange} placeholder="Logradouro" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Número" value={formData['Número'] || ''} onChange={handleInputChange} placeholder="Número" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Bairro" value={formData['Bairro'] || ''} onChange={handleInputChange} placeholder="Bairro" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Complemento" value={formData['Complemento'] || ''} onChange={handleInputChange} placeholder="Complemento" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="CEP" value={formData['CEP'] || ''} onChange={handleInputChange} placeholder="CEP" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="DDI" value={formData['DDI'] || ''} onChange={handleInputChange} placeholder="DDI" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Telefones" value={formData['Telefones'] || ''} onChange={handleInputChange} placeholder="Telefones" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Observação" value={formData['Observação'] || ''} onChange={handleInputChange} placeholder="Observação" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="CPF/CNPJ" value={formData['CPF/CNPJ'] || ''} onChange={handleInputChange} placeholder="CPF/CNPJ *" required className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Nome Contato" value={formData['Nome Contato'] || ''} onChange={handleInputChange} placeholder="Nome Contato" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />

            <input name="E-mail Contato" value={formData['E-mail Contato'] || ''} onChange={handleInputChange} placeholder="E-mail Contato" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Cargo Contato" value={formData['Cargo Contato'] || ''} onChange={handleInputChange} placeholder="Cargo Contato" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="DDI Contato" value={formData['DDI Contato'] || ''} onChange={handleInputChange} placeholder="DDI Contato" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Telefones Contato" value={formData['Telefones Contato'] || ''} onChange={handleInputChange} placeholder="Telefones Contato" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Tipo do Serv. Comunicação" value={formData['Tipo do Serv. Comunicação'] || ''} onChange={handleInputChange} placeholder="Tipo Serv. Comunicação" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="ID do Serv. Comunicação" value={formData['ID do Serv. Comunicação'] || ''} onChange={handleInputChange} placeholder="ID Serv. Comunicação" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Área" value={formData['Área'] || ''} onChange={handleInputChange} placeholder="Área" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Nome da Empresa" value={formData['Nome da Empresa'] || ''} onChange={handleInputChange} placeholder="Nome da Empresa" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Etapa" value={formData['Etapa'] || ''} onChange={handleInputChange} placeholder="Etapa" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
            <input name="Funil" value={formData['Funil'] || ''} onChange={handleInputChange} placeholder="Funil" className="p-2 border rounded dark:bg-gray-900 dark:text-white dark:border-gray-600" />
          </div>
          <div className="mt-6 flex justify-between">
            <button type="button" onClick={handleEnrich} disabled={isEnriching || isSaving} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400">
              {isEnriching ? 'Enriquecendo...' : 'Enriquecer Dados'}
            </button>
            <div>
              <button type="button" onClick={onClose} className="px-4 py-2 mr-2 bg-gray-300 rounded hover:bg-gray-400">Cancelar</button>
              <button type="submit" disabled={isSaving || isEnriching} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">
                {isSaving ? 'Salvando...' : (isEditMode ? 'Atualizar Lead' : 'Salvar Empresa')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [forceStatus, setForceStatus] = useState<{ [cnpj: string]: boolean }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTarget, setActiveModalTarget] = useState<'client' | number | null>(null);
  const [modalInitialData, setModalInitialData] = useState<Partial<Company> | null>(null);

  const handleForceStatusChange = (cnpj: string, isForced: boolean) => {
    setForceStatus(prev => ({ ...prev, [cnpj]: isForced }));
  };

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
    if (!client) {
      alert('Por favor, selecione um Cliente Principal antes de consultar.');
      return;
    }
    const allCompanies = [client, ...competitors].filter((c): c is Company => c !== null);
    if (allCompanies.length === 0) return;

    setGlobalLoading(true);
    setResults(allCompanies.map(c => ({ company: c, data: null, status: 'idle' })));

    const consultations = allCompanies.map(c => {
        const isForced = forceStatus[c.CNPJ_Empresa] || false;
        return runConsultation(c, isForced);
    });

    await Promise.all(consultations);

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

  const openModal = (target: 'client' | number, initialData: Partial<Company> | null = null) => {
    setActiveModalTarget(target);
    setModalInitialData(initialData);
    setIsModalOpen(true);
  };

  const handleSaveNewCompany = (newCompany: Company) => {
    if (activeModalTarget === 'client') {
      setClient(newCompany);
    } else if (typeof activeModalTarget === 'number') {
      const newCompetitors = [...competitors];
      newCompetitors[activeModalTarget] = newCompany;
      setCompetitors(newCompetitors);
    }
    setActiveModalTarget(null);
    setModalInitialData(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveModalTarget(null);
    setModalInitialData(null);
  };

  return (
    <div className="container mx-auto p-4 text-gray-900 dark:text-gray-100">
      <NewCompanyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSaveSuccess={handleSaveNewCompany}
        initialData={modalInitialData}
      />
      <h1 className="text-3xl font-bold mb-6">Comparativo PER/DCOMP</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="font-semibold block mb-2">Cliente Principal</label>
            <Autocomplete
              selectedCompany={client}
              onSelect={setClient}
              onClear={() => {
                if (client) handleForceStatusChange(client.CNPJ_Empresa, false);
                setClient(null);
              }}
              onForceChange={(isForced) => {
                if (client) handleForceStatusChange(client.CNPJ_Empresa, isForced);
              }}
              onRegisterNew={() => openModal('client', null)}
              onEnrichRequest={() => openModal('client', client)}
            />
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
                <Autocomplete
                  selectedCompany={comp}
                  onSelect={(s) => {
                    const newCompetitors = [...competitors];
                    newCompetitors[index] = s;
                    setCompetitors(newCompetitors);
                  }}
                  onClear={() => {
                    const compToClear = competitors[index];
                    if (compToClear) handleForceStatusChange(compToClear.CNPJ_Empresa, false);
                    const newCompetitors = [...competitors];
                    newCompetitors[index] = null;
                    setCompetitors(newCompetitors);
                  }}
                  onForceChange={(isForced) => {
                    if (comp) handleForceStatusChange(comp.CNPJ_Empresa, isForced);
                  }}
                  onRegisterNew={() => openModal(index, null)}
                  onEnrichRequest={() => openModal(index, comp)}
                />
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
            <button onClick={handleConsult} disabled={globalLoading} className="px-8 py-3 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto">
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
    </div>
  );
}
