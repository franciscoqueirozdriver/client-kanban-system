'use client';

import { useState, useEffect, FormEvent } from 'react';
import { FaSpinner } from 'react-icons/fa';

// --- Types ---

// This should match the structure in lib/perplexity.ts
export interface CompanySuggestion {
  Cliente_ID?: string;
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  País_Empresa?: string;
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
}

// This should match the structure expected by the Autocomplete component on the main page
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

export interface NewCompanyModalProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSaved: (company: Company) => void;
}

const initialFormData: CompanySuggestion = {
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
};

// --- Component ---

export default function NewCompanyModal({ isOpen, initialQuery, onClose, onSaved }: NewCompanyModalProps) {
  const [formData, setFormData] = useState<CompanySuggestion>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill form when modal opens with an initial query
    if (isOpen) {
      setFormData({ ...initialFormData, Nome_da_Empresa: initialQuery || '' });
      setError(null);
      setApiMessage(null);
    }
  }, [isOpen, initialQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEnrich = async () => {
    if (!formData.Nome_da_Empresa) {
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
          nome: formData.Nome_da_Empresa,
          cnpj: formData.CNPJ_Empresa,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Falha ao buscar dados.');
      }

      // Merge suggestions, but don't overwrite what the user has already typed
      setFormData((prev) => {
        const newFormData = { ...prev };
        for (const key in data) {
            // This logic fills the field only if it was empty before, preserving user input.
            if (newFormData[key] === '' || newFormData[key] === initialFormData[key]) {
                 newFormData[key] = data[key];
            }
        }
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
    if (!formData.Nome_da_Empresa) {
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
        // Handle specific conflict/suggestion cases
        if (res.status === 409) {
           setError(`CNPJ já cadastrado. ${data.message || ''}`);
        } else {
            throw new Error(data.message || 'Erro ao cadastrar empresa.');
        }
      } else {
        // Handle enrich-existing suggestion
        if (data.mode === 'enrich-existing') {
            setApiMessage(data.message);
            // Pre-fill the form with the data of the existing company
            const companyToEnrich = {
                ...data.company,
                // The API returns headers with spaces, we need to map them to our form state keys
                Nome_da_Empresa: data.company['Nome da Empresa'],
                CNPJ_Empresa: data.company['CNPJ Empresa'],
                Site_Empresa: data.company['Site Empresa'],
                País_Empresa: data.company['País Empresa'],
                Estado_Empresa: data.company['Estado Empresa'],
                Cidade_Empresa: data.company['Cidade Empresa'],
                Logradouro_Empresa: data.company['Logradouro Empresa'],
                Numero_Empresa: data.company['Numero Empresa'],
                Bairro_Empresa: data.company['Bairro Empresa'],
                Complemento_Empresa: data.company['Complemento Empresa'],
                CEP_Empresa: data.company['CEP Empresa'],
                DDI_Empresa: data.company['DDI Empresa'],
                Telefones_Empresa: data.company['Telefones Empresa'],
                Observacao_Empresa: data.company['Observação Empresa'],
            };
            setFormData(companyToEnrich);
            setError("Os dados acima foram pré-preenchidos. Adicione o CNPJ e salve para enriquecer o cadastro existente.");
        } else {
            // Success case
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Cadastrar Nova Empresa</h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-3">
            {/* Form Fields */}
            <input type="text" name="Cliente_ID" value="Será gerado ao salvar" readOnly className="p-2 border rounded bg-gray-200 dark:bg-gray-700 text-gray-500 w-full" />
            <input type="text" name="Nome_da_Empresa" placeholder="Nome da Empresa *" value={formData.Nome_da_Empresa || ''} onChange={handleChange} required className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="CNPJ_Empresa" placeholder="CNPJ Empresa" value={formData.CNPJ_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Site_Empresa" placeholder="Site Empresa" value={formData.Site_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="País_Empresa" placeholder="País Empresa" value={formData.País_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Estado_Empresa" placeholder="Estado Empresa" value={formData.Estado_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Cidade_Empresa" placeholder="Cidade Empresa" value={formData.Cidade_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Logradouro_Empresa" placeholder="Logradouro Empresa" value={formData.Logradouro_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Numero_Empresa" placeholder="Número Empresa" value={formData.Numero_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Bairro_Empresa" placeholder="Bairro Empresa" value={formData.Bairro_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Complemento_Empresa" placeholder="Complemento Empresa" value={formData.Complemento_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="CEP_Empresa" placeholder="CEP Empresa" value={formData.CEP_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="DDI_Empresa" placeholder="DDI Empresa" value={formData.DDI_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Telefones_Empresa" placeholder="Telefones Empresa" value={formData.Telefones_Empresa || ''} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <textarea name="Observacao_Empresa" placeholder="Observação Empresa (max 280 chars)" value={formData.Observacao_Empresa || ''} onChange={handleChange} maxLength={280} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2 h-20" />
          </div>

          {/* Messages */}
          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
          {apiMessage && <div className="mt-4 text-blue-500 text-sm">{apiMessage}</div>}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-between items-center">
             <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400">
                Cancelar
             </button>
            <div className="flex gap-4">
              <button type="button" onClick={handleEnrich} disabled={isEnriching || isLoading} className="px-3 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-violet-400 flex items-center gap-2">
                {isEnriching && <FaSpinner className="animate-spin" />}
                Enriquecer
              </button>
              <button type="submit" disabled={isLoading || isEnriching} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 flex items-center gap-2">
                {isLoading && <FaSpinner className="animate-spin" />}
                Cadastrar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
