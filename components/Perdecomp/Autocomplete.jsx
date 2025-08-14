'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaPlusCircle } from 'react-icons/fa';

// Debounce function to limit API calls
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

export default function Autocomplete({ onSelect, selectedValue, onClear }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showCreateNew, setShowCreateNew] = useState(false);

    useEffect(() => {
        if (selectedValue) {
            setSearchTerm(selectedValue.Nome_da_Empresa || selectedValue.CNPJ_Empresa || '');
        } else {
            setSearchTerm('');
        }
    }, [selectedValue]);

    const fetchSuggestions = async (query) => {
        if (query.length < 3) {
            setSuggestions([]);
            setShowCreateNew(false);
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            setSuggestions(data);
            setShowCreateNew(data.length === 0);
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
            setSuggestions([]);
        }
        setIsLoading(false);
    };

    const debouncedFetch = useCallback(debounce(fetchSuggestions, 300), []);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowSuggestions(true);
        onClear?.(); // Clear selection if user types again
        debouncedFetch(value);
    };

    const handleSelect = (suggestion) => {
        setSearchTerm(suggestion.Nome_da_Empresa);
        setShowSuggestions(false);
        onSelect(suggestion);
    };

    const handleCreateNew = () => {
        const isCnpj = /^\d{14}$/.test(searchTerm.replace(/\D/g, ''));
        onSelect({
            [isCnpj ? 'CNPJ_Empresa' : 'Nome_da_Empresa']: searchTerm,
            isNew: true, // Flag to indicate this is a new entry
        });
        setShowSuggestions(false);
    }

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                placeholder="Digite o Nome ou CNPJ"
                className="w-full p-2 border rounded bg-gray-700 text-white"
            />
            {showSuggestions && searchTerm && (
                <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-b-lg max-h-60 overflow-y-auto">
                    {isLoading && <li className="p-2 text-gray-400">Buscando...</li>}
                    {!isLoading && suggestions.map((s, index) => (
                        <li
                            key={s.Cliente_ID || index}
                            onClick={() => handleSelect(s)}
                            className="p-2 hover:bg-gray-700 cursor-pointer"
                        >
                            {s.Nome_da_Empresa} <span className="text-xs text-gray-400">{s.CNPJ_Empresa}</span>
                        </li>
                    ))}
                    {!isLoading && showCreateNew && (
                         <li
                            onClick={handleCreateNew}
                            className="p-2 flex items-center gap-2 hover:bg-violet-700 cursor-pointer text-violet-300"
                        >
                            <FaPlusCircle />
                            <span>Cadastrar nova empresa: "{searchTerm}"</span>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
