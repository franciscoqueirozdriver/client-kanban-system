'use client';
import { useState, useEffect, useRef, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { FaSpinner } from 'react-icons/fa';
import { HiSelector, HiCheck } from 'react-icons/hi';
import { MdAddBusiness, MdOutlineScreenSearchDesktop } from "react-icons/md";

interface Company {
  Cliente_ID: string;
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;
}

interface AutocompleteProps {
  selectedCompany: Company | null;
  onSelect: (company: Company) => void;
  onClear: () => void;
  onNoResults?: (query: string) => void;
  onEnrichSelected?: (company: Company) => void;
  onEnrichQuery?: (query: string) => void;
  isEnriching?: boolean;
  initialQuery?: string;
}

export default function Autocomplete({
  selectedCompany,
  onSelect,
  onClear,
  onNoResults,
  onEnrichSelected,
  onEnrichQuery,
  isEnriching = false,
  initialQuery = '',
}: AutocompleteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2 && !selectedCompany) {
        setLoading(true);
        fetch(`/api/clientes/buscar?q=${query}`)
          .then((res) => res.json())
          .then((data) => {
            setResults(Array.isArray(data) ? data : []);
            setLoading(false);
          });
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, selectedCompany]);

  const handleSelect = (company: Company | null) => {
    if (company) {
      onSelect(company);
      setQuery(company.Nome_da_Empresa);
      setResults([]);
    }
  };

  const handleClear = () => {
    onClear();
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const showNoResults = query.length > 2 && !loading && results.length === 0 && !selectedCompany;

  return (
    <Combobox value={selectedCompany} onChange={handleSelect}>
      <div className="relative">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-300 sm:text-sm">
          <Combobox.Input
            ref={inputRef}
            className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 dark:text-gray-100 bg-transparent focus:ring-0"
            displayValue={(c: Company) => c?.Nome_da_Empresa || query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o nome ou CNPJ da empresa..."
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            {loading || isEnriching ? <FaSpinner className="animate-spin h-5 w-5 text-gray-400" /> : <HiSelector className="h-5 w-5 text-gray-400" aria-hidden="true" />}
          </Combobox.Button>
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => { if(!selectedCompany) setQuery('')}}
        >
          <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-10">
            {showNoResults && (
              <div className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-300">
                Nenhum resultado.
                <div className="mt-2 flex gap-2">
                    {onNoResults && <button type="button" onClick={() => onNoResults(query)} className="flex-1 text-center text-sm p-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"> <MdAddBusiness className="inline mr-1" /> Cadastrar "{query}"</button>}
                    {onEnrichQuery && <button type="button" onClick={() => onEnrichQuery(query)} className="flex-1 text-center text-sm p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><MdOutlineScreenSearchDesktop className="inline mr-1" /> Enriquecer "{query}"</button>}
                </div>
              </div>
            )}
            {results.map((company) => (
              <Combobox.Option
                key={company.Cliente_ID}
                className={({ active }) => `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-violet-600 text-white' : 'text-gray-900 dark:text-gray-200'}`}
                value={company}
              >
                {({ selected, active }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                      {company.Nome_da_Empresa}
                    </span>
                    <span className={`block text-xs ${active ? 'text-violet-200' : 'text-gray-500'}`}>
                        {company.CNPJ_Empresa}
                    </span>
                    {selected ? (
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-violet-600'}`}>
                        <HiCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Transition>
        {selectedCompany && (
            <div className="absolute inset-y-0 right-8 flex items-center gap-2">
                {onEnrichSelected && <button type="button" onClick={() => onEnrichSelected(selectedCompany)} className="p-1 text-blue-600 hover:text-blue-800" title="Enriquecer dados do cliente selecionado"><MdOutlineScreenSearchDesktop /></button>}
                <button type="button" onClick={handleClear} className="p-1 text-red-500 hover:text-red-700" title="Limpar seleção">X</button>
            </div>
        )}
      </div>
    </Combobox>
  );
}