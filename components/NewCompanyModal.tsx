'use client';

import { useState, useEffect, FormEvent } from 'react';
import { FaSpinner } from 'react-icons/fa';

// --- Types ---

interface CompanyData {
  Nome_da_Empresa: string;
  Site_Empresa: string;
  País_Empresa: string;
  Estado_Empresa: string;
  Cidade_Empresa: string;
  Logradouro_Empresa: string;
  Numero_Empresa: string;
  Bairro_Empresa: string;
  Complemento_Empresa: string;
  CEP_Empresa: string;
  CNPJ_Empresa: string;
  DDI_Empresa: string;
  Telefones_Empresa: string;
  Observacao_Empresa: string;
}

interface ContactData {
  Nome_Contato: string;
  Email_Contato: string;
  Cargo_Contato: string;
  DDI_Contato: string;
  Telefones_Contato: string;
}

interface CommercialData {
  Origem: string;
  Sub_Origem: string;
  Mercado: string;
  Produto: string;
  Área: string;
  Etapa: string;
  Funil: string;
  Tipo_do_Serv_Comunicacao: string;
  ID_do_Serv_Comunicacao: string;
}

interface FullCompanyPayload {
  Cliente_ID?: string; // Used for updates
  Empresa: CompanyData;
  Contato: ContactData;
  Comercial: CommercialData;
}

// For the onSaved callback
interface SavedCompany {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
}

export interface NewCompanyModalProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSaved: (company: SavedCompany) => void;
}

const initialFormData: FullCompanyPayload = {
  Empresa: {
    Nome_da_Empresa: '',
    Site_Empresa: '',
    País_Empresa: 'Brasil',
    Estado_Empresa: '',
    Cidade_Empresa: '',
    Logradouro_Empresa: '',
    Numero_Empresa: '',
    Bairro_Empresa: '',
    Complemento_Empresa: '',
    CEP_Empresa: '',
    CNPJ_Empresa: '',
    DDI_Empresa: '+55',
    Telefones_Empresa: '',
    Observacao_Empresa: '',
  },
  Contato: {
    Nome_Contato: '',
    Email_Contato: '',
    Cargo_Contato: '',
    DDI_Contato: '+55',
    Telefones_Contato: '',
  },
  Comercial: {
    Origem: 'Cadastro Manual',
    Sub_Origem: 'Modal PER/DCOMP',
    Mercado: '',
    Produto: '',
    Área: '',
    Etapa: 'Novo',
    Funil: 'Padrão',
    Tipo_do_Serv_Comunicacao: '',
    ID_do_Serv_Comunicacao: '',
  },
};

// --- Component ---

export default function NewCompanyModal({ isOpen, initialQuery, onClose, onSaved }: NewCompanyModalProps) {
  const [formData, setFormData] = useState<FullCompanyPayload>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  const isUpdateMode = !!formData.Cliente_ID;

  useEffect(() => {
    if (isOpen) {
      // Reset form state on open, pre-filling with initial query
      const newFormState = JSON.parse(JSON.stringify(initialFormData)); // Deep copy
      newFormState.Empresa.Nome_da_Empresa = initialQuery || '';
      setFormData(newFormState);
      setError(null);
      setApiMessage(null);
    }
  }, [isOpen, initialQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const [section, field] = name.split('.');

    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleEnrich = async () => {
    if (!formData.Empresa.Nome_da_Empresa) {
      setError('O "Nome da Empresa" é necessário para enriquecer.');
      return;
    }
    setIsEnriching(true);
    setError(null);
    setApiMessage(null);
    try {
      const res = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.Empresa.Nome_da_Empresa,
          cnpj: formData.Empresa.CNPJ_Empresa,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Falha ao buscar dados de enriquecimento.');
      }

      const suggestions = data.suggestion || {};

      setFormData((prev) => {
        const newFormData = JSON.parse(JSON.stringify(prev)); // Deep copy to avoid mutation issues

        const empresaMap = {
            Nome_da_Empresa: suggestions.Nome_da_Empresa, Site_Empresa: suggestions.Site_Empresa, País_Empresa: suggestions.Pais_Empresa, Estado_Empresa: suggestions.Estado_Empresa, Cidade_Empresa: suggestions.Cidade_Empresa, Logradouro_Empresa: suggestions.Logradouro_Empresa, Numero_Empresa: suggestions.Numero_Empresa, Bairro_Empresa: suggestions.Bairro_Empresa, Complemento_Empresa: suggestions.Complemento_Empresa, CEP_Empresa: suggestions.CEP_Empresa, CNPJ_Empresa: suggestions.CNPJ_Empresa, DDI_Empresa: suggestions.DDI_Empresa, Telefones_Empresa: suggestions.Telefones_Empresa, Observacao_Empresa: suggestions.Observacao_Empresa
        };
        const contatoMap = {
            Nome_Contato: suggestions.Nome_Contato, Email_Contato: suggestions.Email_Contato, Cargo_Contato: suggestions.Cargo_Contato, DDI_Contato: suggestions.DDI_Contato, Telefones_Contato: suggestions.Telefones_Contato
        };
        const comercialMap = {
            Mercado: suggestions.Mercado, Produto: suggestions.Produto, Área: suggestions.Area
        };

        // Fill only empty fields
        Object.keys(empresaMap).forEach(key => {
            if (!newFormData.Empresa[key] && empresaMap[key]) newFormData.Empresa[key] = empresaMap[key];
        });
        Object.keys(contatoMap).forEach(key => {
            if (!newFormData.Contato[key] && contatoMap[key]) newFormData.Contato[key] = contatoMap[key];
        });
        Object.keys(comercialMap).forEach(key => {
            if (!newFormData.Comercial[key] && comercialMap[key]) newFormData.Comercial[key] = comercialMap[key];
        });

        return newFormData;
      });

      setApiMessage('Dados sugeridos foram preenchidos. Você pode editá-los antes de salvar.');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.Empresa.Nome_da_Empresa) {
      setError('O "Nome da Empresa" é obrigatório.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setApiMessage(null);
    try {
      const res = await fetch('/api/empresas/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
           setError(`CNPJ já cadastrado. ${data.message || ''}`);
        } else {
            throw new Error(data.message || 'Erro ao salvar empresa.');
        }
      } else {
        if (data.mode === 'enrich-existing') {
            setApiMessage(data.message);
            const existing = data.company;
            // Pre-fill the entire form for update
            setFormData({
                Cliente_ID: existing.Cliente_ID,
                Empresa: {
                    Nome_da_Empresa: existing['Nome da Empresa'] || '',
                    Site_Empresa: existing['Site Empresa'] || '',
                    País_Empresa: existing['País Empresa'] || 'Brasil',
                    Estado_Empresa: existing['Estado Empresa'] || '',
                    Cidade_Empresa: existing['Cidade Empresa'] || '',
                    Logradouro_Empresa: existing['Logradouro Empresa'] || '',
                    Numero_Empresa: existing['Numero Empresa'] || '',
                    Bairro_Empresa: existing['Bairro Empresa'] || '',
                    Complemento_Empresa: existing['Complemento Empresa'] || '',
                    CEP_Empresa: existing['CEP Empresa'] || '',
                    CNPJ_Empresa: existing['CNPJ Empresa'] || '',
                    DDI_Empresa: existing['DDI Empresa'] || '+55',
                    Telefones_Empresa: existing['Telefones Empresa'] || '',
                    Observacao_Empresa: existing['Observação Empresa'] || '',
                },
                Contato: {
                    Nome_Contato: existing['Nome Contato'] || '',
                    Email_Contato: existing['E-mail Contato'] || '',
                    Cargo_Contato: existing['Cargo Contato'] || '',
                    DDI_Contato: existing['DDI Contato'] || '+55',
                    Telefones_Contato: existing['Telefones Contato'] || '',
                },
                Comercial: {
                    Origem: existing['Origem'] || 'Cadastro Manual',
                    Sub_Origem: existing['Sub-Origem'] || 'Modal PER/DCOMP',
                    Mercado: existing['Mercado'] || '',
                    Produto: existing['Produto'] || '',
                    Área: existing['Área'] || '',
                    Etapa: existing['Etapa'] || 'Novo',
                    Funil: existing['Funil'] || 'Padrão',
                    Tipo_do_Serv_Comunicacao: existing['Tipo do Serv. Comunicação'] || '',
                    ID_do_Serv_Comunicacao: existing['ID do Serv. Comunicação'] || '',
                }
            });
            setError("Os dados acima foram pré-preenchidos. Complete ou corrija as informações e clique em 'Atualizar' para salvar.");
        } else {
            onSaved(data.company);
            onClose();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{isUpdateMode ? 'Atualizar Empresa' : 'Cadastrar Nova Empresa'}</h2>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto pr-3">
          {/* Empresa Section */}
          <h3 className="text-lg font-semibold mt-4 mb-2 border-b pb-1">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" name="Empresa.Nome_da_Empresa" placeholder="Nome da Empresa *" value={formData.Empresa.Nome_da_Empresa} onChange={handleChange} required className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2" />
            <input type="text" name="Empresa.CNPJ_Empresa" placeholder="CNPJ Empresa" value={formData.Empresa.CNPJ_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.Site_Empresa" placeholder="Site Empresa" value={formData.Empresa.Site_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-3" />
            <input type="text" name="Empresa.Logradouro_Empresa" placeholder="Logradouro" value={formData.Empresa.Logradouro_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2" />
            <input type="text" name="Empresa.Numero_Empresa" placeholder="Número" value={formData.Empresa.Numero_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.Bairro_Empresa" placeholder="Bairro" value={formData.Empresa.Bairro_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.Cidade_Empresa" placeholder="Cidade" value={formData.Empresa.Cidade_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.Estado_Empresa" placeholder="Estado (UF)" value={formData.Empresa.Estado_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.CEP_Empresa" placeholder="CEP" value={formData.Empresa.CEP_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.País_Empresa" placeholder="País" value={formData.Empresa.País_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.DDI_Empresa" placeholder="DDI" value={formData.Empresa.DDI_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Empresa.Telefones_Empresa" placeholder="Telefones (separados por ;)" value={formData.Empresa.Telefones_Empresa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-3" />
            <textarea name="Empresa.Observacao_Empresa" placeholder="Observação da Empresa" value={formData.Empresa.Observacao_Empresa} onChange={handleChange} maxLength={280} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-3 h-20" />
          </div>

          {/* Contato Section */}
          <h3 className="text-lg font-semibold mt-6 mb-2 border-b pb-1">Dados de Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="Contato.Nome_Contato" placeholder="Nome do Contato" value={formData.Contato.Nome_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Contato.Cargo_Contato" placeholder="Cargo do Contato" value={formData.Contato.Cargo_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="email" name="Contato.Email_Contato" placeholder="E-mail do Contato" value={formData.Contato.Email_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2" />
            <input type="text" name="Contato.DDI_Contato" placeholder="DDI Contato" value={formData.Contato.DDI_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Contato.Telefones_Contato" placeholder="Telefones do Contato (por ;)" value={formData.Contato.Telefones_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
          </div>

          {/* Comercial/Pipeline Section */}
          <h3 className="text-lg font-semibold mt-6 mb-2 border-b pb-1">Comercial / Pipeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" name="Comercial.Origem" value={formData.Comercial.Origem} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Sub_Origem" value={formData.Comercial.Sub_Origem} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Etapa" value={formData.Comercial.Etapa} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Funil" value={formData.Comercial.Funil} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Mercado" placeholder="Mercado" value={formData.Comercial.Mercado} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Produto" placeholder="Produto" value={formData.Comercial.Produto} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Área" placeholder="Área" value={formData.Comercial.Área} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.Tipo_do_Serv_Comunicacao" placeholder="Tipo Serviço Comunicação" value={formData.Comercial.Tipo_do_Serv_Comunicacao} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Comercial.ID_do_Serv_Comunicacao" placeholder="ID Serviço Comunicação" value={formData.Comercial.ID_do_Serv_Comunicacao} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
          </div>

          {/* Messages and Buttons */}
          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
          {apiMessage && <div className="mt-4 text-blue-500 text-sm">{apiMessage}</div>}
          <div className="mt-6 flex justify-between items-center pt-4 border-t">
             <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400">Cancelar</button>
            <div className="flex gap-4">
              <button type="button" onClick={handleEnrich} disabled={isEnriching || isLoading} className="px-3 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-violet-400 flex items-center gap-2">
                {isEnriching && <FaSpinner className="animate-spin" />}
                Enriquecer
              </button>
              <button type="submit" disabled={isLoading || isEnriching} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 flex items-center gap-2">
                {isLoading && <FaSpinner className="animate-spin" />}
                {isUpdateMode ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
