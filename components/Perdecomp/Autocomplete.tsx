'use client';

import { useState, useEffect } from 'react';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
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


// --- Autocomplete Component ---
interface AutocompleteProps {
  selectedCompany: Company | null;
  onSelect: (company: Company) => void;
  onClear: () => void;
  onNoResults?: (query: string) => void;
  onEnrichRequest?: (company: Company) => void;
  placeholder?: string;
}

const Autocomplete = ({ selectedCompany, onSelect, onClear, onNoResults, onEnrichRequest, placeholder = "Digite o Nome ou CNPJ" }: AutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear results and error if query is too short
    if (query.length < 3) {
      setResults([]);
      setError(null);
      return;
    }

    // Debounce the API call
    const debounce = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/clientes/buscar?q=${query}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          // Check for invalid CNPJ only if the query looks like a full CNPJ but returns no results
          if (data.length === 0 && /^\d{14}$/.test(query.replace(/\D/g, '')) && !isValidCnpj(query)) {
              setError("CNPJ inválido.");
          }
        } else {
          setError("Falha ao buscar dados.");
        }
      } catch (error) {
        setError("Erro de conexão.");
        console.error("Failed to fetch companies", error);
      }
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(debounce);
  }, [query]);

  useEffect(() => {
    if (results.length > 0) {
      setShowSuggestions(true);
    }
  }, [results]);

  const handleSelect = (company: Company) => {
    setQuery('');
    setResults([]);
    setShowSuggestions(false);
    onSelect(company);
  };

  if (selectedCompany) {
    return (
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
        <div className="flex items-center justify-between">
            <div className="flex-grow truncate">
                <p className="font-semibold text-sm truncate" title={selectedCompany.Nome_da_Empresa}>{selectedCompany.Nome_da_Empresa}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCompany.CNPJ_Empresa || 'CNPJ não informado'}</p>
            </div>
            <button type="button" onClick={onClear} className="ml-2 text-red-500 hover:text-red-700 font-bold p-1">X</button>
        </div>
        {!isValidCnpj(selectedCompany.CNPJ_Empresa) && onEnrichRequest && (
          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
            <button
              type="button"
              onClick={() => onEnrichRequest(selectedCompany)}
              className="w-full px-3 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-violet-600 dark:hover:bg-violet-700 dark:focus:ring-violet-400"
              aria-label="Enriquecer Lead (sem CNPJ)"
            >
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
        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading && <li className="p-2 text-gray-500">Buscando...</li>}

          {!isLoading && results.map((company) => (
            <li key={company.Cliente_ID} onMouseDown={() => handleSelect(company)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              {company.Nome_da_Empresa} <span className="text-sm text-gray-500">{company.CNPJ_Empresa}</span>
            </li>
          ))}

          {!isLoading && results.length === 0 && onNoResults && (
            <li className="p-2">
              <p className="text-gray-500 text-sm mb-2 text-center">Nenhum resultado.</p>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onNoResults(query); }}
                className="w-full px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-400"
                aria-label="Cadastrar Nova Empresa"
              >
                + Cadastrar Nova Empresa
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
