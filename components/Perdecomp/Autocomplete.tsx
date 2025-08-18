'use client';

import { useState, useEffect } from 'react';
import { padCNPJ14, isValidCNPJ, onlyDigits } from '@/utils/cnpj';

// --- Helper Types ---
interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
  [key: string]: any;
}

// --- Autocomplete Component ---
interface AutocompleteProps {
  selectedCompany: Company | null;
  onSelect: (company: Company) => void;
  onClear: () => void;
  onNoResults?: (query: string) => void;
  onEnrichSelected?: (company: Company) => void;
  onEnrichQuery?: (query: string) => void;
  isEnriching?: boolean;
  placeholder?: string;
}

const Autocomplete = ({ selectedCompany, onSelect, onClear, onNoResults, onEnrichSelected, onEnrichQuery, isEnriching, placeholder = "Digite o Nome ou CNPJ" }: AutocompleteProps) => {
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
          if (data.length === 0 && /^\d{14}$/.test(onlyDigits(query)) && !isValidCNPJ(query)) {
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
    onSelect({ ...company, CNPJ_Empresa: padCNPJ14(company.CNPJ_Empresa) });
  };

  if (selectedCompany) {
    return (
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded relative">
        <div className="flex items-center justify-between">
          <div className="flex-grow truncate">
            <p className="font-semibold text-sm truncate" title={selectedCompany.Nome_da_Empresa}>{selectedCompany.Nome_da_Empresa}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{padCNPJ14(selectedCompany.CNPJ_Empresa) || 'CNPJ não informado'}</p>
          </div>
          <button type="button" onClick={onClear} className="ml-2 text-red-500 hover:text-red-700 font-bold p-1">X</button>
        </div>
        {onEnrichSelected && !isValidCNPJ(selectedCompany.CNPJ_Empresa) && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onEnrichSelected(selectedCompany)}
              disabled={isEnriching}
              className="px-3 py-1.5 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 disabled:opacity-50">
              {isEnriching ? 'Enriquecendo…' : 'Enriquecer dados'}
            </button>
          </div>
        )}
        {isEnriching && (
          <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex items-center justify-center rounded">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
              Enriquecendo dados…
            </div>
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
      {showSuggestions && !error && (query.length >= 3 || isValidCNPJ(query)) && (
        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto text-gray-900 dark:text-gray-100">
          {isLoading && <li className="p-2 text-gray-500">Buscando...</li>}

          {!isLoading && results.map((company) => (
            <li key={company.Cliente_ID} onMouseDown={() => handleSelect(company)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              {company.Nome_da_Empresa} <span className="text-sm text-gray-500">{padCNPJ14(company.CNPJ_Empresa)}</span>
            </li>
          ))}
        </ul>
      )}
      {!selectedCompany && !isLoading && results.length === 0 && query.trim().length >= 3 && (
        <div className="mt-2 flex gap-2">
          {onEnrichQuery && (
            <button
              type="button"
              onClick={() => onEnrichQuery(query)}
              disabled={isEnriching}
              className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded hover:bg-violet-700 disabled:opacity-50"
            >
              {isEnriching ? 'Enriquecendo…' : 'Enriquecer dados'}
            </button>
          )}
          {onNoResults && (
            <button
              type="button"
              onClick={() => onNoResults(query)}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Cadastrar Nova Empresa
            </button>
          )}
        </div>
      )}
      {isEnriching && (
        <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex items-center justify-center rounded">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
            Enriquecendo dados…
          </div>
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
