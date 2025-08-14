'use client';

import { useState, useEffect, useCallback } from 'react';

interface Company {
  'Cliente_ID': string;
  'Nome da Empresa': string;
  'CNPJ Empresa': string;
  [key: string]: any;
}

interface Props {
  placeholder: string;
  onSelect: (company: Company) => void;
  onClear: () => void;
  onRegister: (searchTerm: string) => void;
  initialValue?: Company;
}

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function AutocompleteInput({ placeholder, onSelect, onClear, onRegister, initialValue }: Props) {
  const [searchTerm, setSearchTerm] = useState(initialValue?.['Nome da Empresa'] || '');
  const [results, setResults] = useState<Company[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(initialValue || null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchData = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setIsOpen(true);
      } else {
        console.error('Failed to fetch autocomplete results');
        setResults([]);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error fetching autocomplete:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm && !selectedCompany) {
      fetchData(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, fetchData, selectedCompany]);

  const handleSelect = (company: Company) => {
    setSearchTerm(company['Nome da Empresa']);
    setSelectedCompany(company);
    setIsOpen(false);
    onSelect(company);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (selectedCompany) {
        setSelectedCompany(null); // Clear selection if user types again
        onClear();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
      />
      {isLoading && <div className="absolute right-2 top-2 h-5 w-5 animate-spin rounded-full border-b-2 border-violet-500"></div>}

      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((company) => (
            <li
              key={company['Cliente_ID'] || company['CNPJ Empresa']}
              onClick={() => handleSelect(company)}
              className="px-4 py-2 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900"
            >
              <p className="font-semibold">{company['Nome da Empresa']}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{company['CNPJ Empresa']}</p>
            </li>
          ))}
        </ul>
      )}

      {isOpen && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <p className="text-center text-gray-500">Nenhum resultado encontrado.</p>
            {/* TODO: Add "Cadastrar" button and logic */}
        </div>
      )}
    </div>
  );
}
