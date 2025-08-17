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

export interface FullCompanyPayload {
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
  initialData?: Partial<FullCompanyPayload>; // Changed from initialQuery
  onClose: () => void;
  onSaved: (company: SavedCompany) => void;
}

const initialFormData: FullCompanyPayload = {
  Empresa: {
    Nome_da_Empresa: '', Site_Empresa: '', País_Empresa: 'Brasil', Estado_Empresa: '', Cidade_Empresa: '',
    Logradouro_Empresa: '', Numero_Empresa: '', Bairro_Empresa: '', Complemento_Empresa: '', CEP_Empresa: '',
    CNPJ_Empresa: '', DDI_Empresa: '+55', Telefones_Empresa: '', Observacao_Empresa: '',
  },
  Contato: {
    Nome_Contato: '', Email_Contato: '', Cargo_Contato: '', DDI_Contato: '+55', Telefones_Contato: '',
  },
  Comercial: {
    Origem: 'Cadastro Manual', Sub_Origem: 'Modal PER/DCOMP', Mercado: '', Produto: '', Área: '',
    Etapa: 'Novo', Funil: 'Padrão', Tipo_do_Serv_Comunicacao: '', ID_do_Serv_Comunicacao: '',
  },
};

// --- Component ---

export default function NewCompanyModal({ isOpen, initialData, onClose, onSaved }: NewCompanyModalProps) {
  const [formData, setFormData] = useState<FullCompanyPayload>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  const isUpdateMode = !!formData.Cliente_ID;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setApiMessage(null);
      // If initialData is provided, use it to populate the form
      if (initialData) {
          // Deep merge initialData with defaults to ensure all keys are present
          const mergedData = {
              ...JSON.parse(JSON.stringify(initialFormData)),
              ...initialData,
              Empresa: { ...initialFormData.Empresa, ...initialData.Empresa },
              Contato: { ...initialFormData.Contato, ...initialData.Contato },
              Comercial: { ...initialFormData.Comercial, ...initialData.Comercial },
          };
          setFormData(mergedData);
      } else {
          // Otherwise, reset to the default blank state
          setFormData(initialFormData);
      }
    }
  }, [isOpen, initialData]);

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
        // The 'enrich-existing' mode is now handled before the modal opens.
        // A successful response here always means the data was saved.
        onSaved(data.company);
        onClose();
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
          {/* Sections... */}
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

          <h3 className="text-lg font-semibold mt-6 mb-2 border-b pb-1">Dados de Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="Contato.Nome_Contato" placeholder="Nome do Contato" value={formData.Contato.Nome_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Contato.Cargo_Contato" placeholder="Cargo do Contato" value={formData.Contato.Cargo_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="email" name="Contato.Email_Contato" placeholder="E-mail do Contato" value={formData.Contato.Email_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full md:col-span-2" />
            <input type="text" name="Contato.DDI_Contato" placeholder="DDI Contato" value={formData.Contato.DDI_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
            <input type="text" name="Contato.Telefones_Contato" placeholder="Telefones do Contato (por ;)" value={formData.Contato.Telefones_Contato} onChange={handleChange} className="p-2 border rounded bg-gray-50 dark:bg-gray-700 w-full" />
          </div>

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

          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
          {apiMessage && <div className="mt-4 text-blue-500 text-sm">{apiMessage}</div>}
          <div className="mt-6 flex justify-between items-center pt-4 border-t">
             <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400">Cancelar</button>
            <div className="flex gap-4">
              {/* Removed Enrich button from modal */}
              <button type="submit" disabled={isLoading} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 flex items-center gap-2">
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
