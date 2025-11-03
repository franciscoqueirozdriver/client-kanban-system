'use client';

import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';
import { isFilial, toMatrizCNPJ, fmtCNPJ, onlyDigits } from '@/utils/cnpj-matriz';

interface Prefill {
  nome_da_empresa?: string;
  site_empresa?: string;
  pais_empresa?: string;
  estado_empresa?: string;
  cidade_empresa?: string;
  logradouro_empresa?: string;
  numero_empresa?: string;
  bairro_empresa?: string;
  complemento_empresa?: string;
  cep_empresa?: string;
  cnpj_empresa?: string;
  cnpj?: string;
  ddi_empresa?: string;
  telefones_empresa?: string;
  observacao_empresa?: string;
  nome_contato?: string;
  email_contato?: string;
  cargo_contato?: string;
  ddi_contato?: string;
  telefones_contato?: string;
  mercado?: string;
  produto?: string;
  area?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  suggestionFlat: Prefill | null;
  baseCompany?: Prefill | null; // <-- Added prop
  rawJson?: any;
  error?: string;
  onConfirm: (flat: Prefill) => void;
}

export default function EnrichmentPreviewDialog({
  isOpen,
  onClose,
  suggestionFlat,
  baseCompany,
  rawJson,
  error,
  onConfirm,
}: Props) {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    matriz?: string;
    filial?: string;
    resolve?: (value: boolean) => void;
  }>({ isOpen: false });

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (!suggestionFlat) return;

    const enrichedCNPJ = suggestionFlat.cnpj_empresa;

    if (!enrichedCNPJ || !isFilial(enrichedCNPJ)) {
      onConfirm(suggestionFlat);
      return;
    }

    const ask = (matriz: string, filial: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({ isOpen: true, matriz, filial, resolve });
      });
    };

    const finalCNPJ = await decideCNPJFinal({
      currentFormCNPJ: baseCompany?.cnpj_empresa,
      enrichedCNPJ: suggestionFlat.cnpj_empresa,
      ask,
    });

    onConfirm({ ...suggestionFlat, cnpj_empresa: finalCNPJ });
    setConfirmState({ isOpen: false });
  };

  const renderConfirmDescription = () => {
    if (!confirmState.matriz || !confirmState.filial) return '';
    const filialFmt = fmtCNPJ(confirmState.filial);
    const matrizFmt = fmtCNPJ(toMatrizCNPJ(confirmState.filial));

    return (
      <>
        <p>Detectamos que o CNPJ <strong>{filialFmt}</strong> é de uma FILIAL.</p>
        <p className="mt-2">Deseja salvar como filial mesmo?</p>
        <p className="mt-2">Se optar por "Usar Matriz", salvaremos o CNPJ <strong>{matrizFmt}</strong>.</p>
      </>
    );
  };

  return (
    <>
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
                onClick={handleConfirmClick}
                className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Usar e abrir cadastro
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => {
          confirmState.resolve?.(false);
          setConfirmState({ isOpen: false });
        }}
        onConfirm={() => {
          confirmState.resolve?.(true);
        }}
        title="CNPJ indica Filial"
        description={renderConfirmDescription()}
        confirmText="Usar Matriz"
        cancelText="Manter Filial"
      />
    </>
  );
}
