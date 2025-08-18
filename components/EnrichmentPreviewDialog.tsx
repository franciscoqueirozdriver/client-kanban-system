'use client';

import React from 'react';

interface Prefill {
  Nome_da_Empresa?: string;
  Site_Empresa?: string;
  Pais_Empresa?: string;
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
  Nome_Contato?: string;
  Email_Contato?: string;
  Cargo_Contato?: string;
  DDI_Contato?: string;
  Telefones_Contato?: string;
  Mercado?: string;
  Produto?: string;
  Area?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  suggestionFlat: Prefill | null;
  rawJson?: any;
  error?: string;
  onConfirm: (flat: Prefill) => void;
}

export default function EnrichmentPreviewDialog({ isOpen, onClose, suggestionFlat, rawJson, error, onConfirm }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-3xl p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Pré-visualização do Enriquecimento</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Fechar</button>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded p-2 text-sm mb-3">{error}</div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Confirme se os dados abaixo estão corretos. Se estiverem, clique em <b>Usar e abrir cadastro</b>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-semibold mb-1">Sugestão (flattened)</p>
                <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-64 overflow-auto">{JSON.stringify(suggestionFlat, null, 2)}</pre>
              </div>
              {rawJson && (
                <div>
                  <p className="text-sm font-semibold mb-1">JSON Parseado (opcional)</p>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-64 overflow-auto">{JSON.stringify(rawJson, null, 2)}</pre>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            Cancelar
          </button>
          {!error && suggestionFlat && (
            <button
              onClick={() => onConfirm(suggestionFlat)}
              className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Usar e abrir cadastro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

