'use client';

import { useState, useEffect } from 'react';

interface Company {
  'Cliente_ID': string;
  'Nome da Empresa': string;
  'Site Empresa': string;
  'País Empresa': string;
  'Estado Empresa': string;
  'Cidade Empresa': string;
  'Logradouro Empresa': string;
  'Numero Empresa': string;
  'Bairro Empresa': string;
  'Complemento Empresa': string;
  'CEP Empresa': string;
  'CNPJ Empresa': string;
  'DDI Empresa': string;
  'Telefones Empresa': string;
  'Observação Empresa': string;
}

interface Props {
  initialData?: Partial<Company>;
  onSave: (company: Company) => void;
  onClose: () => void;
}

export default function RegistrationForm({ initialData, onSave, onClose }: Props) {
  const [company, setCompany] = useState<Partial<Company>>(initialData || {});
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Generate a simple client ID if one isn't provided
    if (!company['Cliente_ID']) {
        setCompany(c => ({ ...c, 'Cliente_ID': `C${Date.now()}`}));
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompany(prev => ({ ...prev, [name]: value }));
  };

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
        const response = await fetch('/api/clientes/enriquecer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: company['Nome da Empresa'], site: company['Site Empresa'] }),
        });
        const result = await response.json();
        if (result.ok) {
            // The API returns data with different keys, need to map them
            const enriched = result.data;
            setCompany(prev => ({
                ...prev,
                'Site Empresa': enriched.site || prev['Site Empresa'],
                'País Empresa': enriched.pais || prev['País Empresa'],
                'Estado Empresa': enriched.estado || prev['Estado Empresa'],
                'Cidade Empresa': enriched.cidade || prev['Cidade Empresa'],
                'Logradouro Empresa': enriched.logradouro || prev['Logradouro Empresa'],
                'CEP Empresa': enriched.cep || prev['CEP Empresa'],
                'CNPJ Empresa': enriched.cnpj || prev['CNPJ Empresa'],
            }));
        } else {
            alert(`Erro ao enriquecer: ${result.message}`);
        }
    } catch (error) {
        alert(`Erro de rede ao enriquecer dados.`);
    } finally {
        setIsEnriching(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        // Here we need to map the form state to the format expected by `appendCompanyImportRow`
        const dataToSave = {
            cliente_id: company['Cliente_ID'],
            nome: company['Nome da Empresa'],
            site: company['Site Empresa'],
            pais: company['País Empresa'],
            estado: company['Estado Empresa'],
            cidade: company['Cidade Empresa'],
            logradouro: company['Logradouro Empresa'],
            numero: company['Numero Empresa'],
            bairro: company['Bairro Empresa'],
            complemento: company['Complemento Empresa'],
            cep: company['CEP Empresa'],
            cnpj: company['CNPJ Empresa'],
            ddi: company['DDI Empresa'],
            telefone: company['Telefones Empresa'],
            observacao: company['Observação Empresa'],
        };
        const response = await fetch('/api/clientes/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave),
        });
        const result = await response.json();
        if (result.ok) {
            onSave(company as Company);
        } else {
            alert(`Erro ao salvar: ${result.message}`);
        }
    } catch (error) {
        alert('Erro de rede ao salvar empresa.');
    } finally {
        setIsSaving(false);
    }
  };

  const formFields: (keyof Company)[] = [
    'Nome da Empresa', 'CNPJ Empresa', 'Site Empresa', 'Telefones Empresa', 'Observação Empresa',
    'Logradouro Empresa', 'Numero Empresa', 'Bairro Empresa', 'Complemento Empresa', 'Cidade Empresa', 'Estado Empresa', 'País Empresa', 'CEP Empresa',
    'DDI Empresa', 'Cliente_ID',
  ];

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formFields.map(fieldName => (
                <div key={fieldName}>
                    <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{fieldName.replace(/ (Empresa|ID)/g, '')}</label>
                    <input
                        type="text"
                        id={fieldName}
                        name={fieldName}
                        value={company[fieldName] || ''}
                        onChange={handleChange}
                        disabled={fieldName === 'Cliente_ID'}
                        className="mt-1 block w-full p-2 border rounded bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:bg-gray-200"
                    />
                </div>
            ))}
        </div>
        <div className="flex justify-end gap-4 pt-4">
            <button onClick={handleEnrich} disabled={isEnriching || !company['Nome da Empresa']} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {isEnriching ? 'Enriquecendo...' : 'Enriquecer Dados'}
            </button>
            <button onClick={handleSave} disabled={isSaving || !company['Nome da Empresa']} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600">
                Cancelar
            </button>
        </div>
    </div>
  );
}
