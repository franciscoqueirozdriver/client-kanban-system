import { useEffect, useRef } from 'react';

interface Company {
  nome_da_empresa: string;
  cnpj_empresa: string;
  [key: string]: any;
}

type ApiDebug = {
  requestedAt?: string;
  fonte?: 'api' | 'planilha';
  apiRequest?: any;
  apiResponse?: any;
  mappedCount?: number;
  siteReceipts?: string[];
  header?: any;
} | null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  debug: ApiDebug;
}

export default function PerdcompApiPreviewDialog({ isOpen, onClose, company, debug }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handler);
      setTimeout(() => closeRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (debug?.apiResponse) {
      navigator.clipboard.writeText(JSON.stringify(debug.apiResponse, null, 2));
    }
  };

  const fontePill = debug?.fonte === 'api'
    ? <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 rounded-full text-xs">API</span>
    : debug?.fonte === 'planilha'
      ? <span className="px-2 py-0.5 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full text-xs">Planilha</span>
      : null;

  const firstPerdcomp = debug?.apiResponse?.data?.[0]?.perdcomp?.[0];

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white dark:bg-gray-900 shadow-xl p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Retorno da API – {company?.Nome_da_Empresa}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{company?.CNPJ_Empresa}</p>
          </div>
          <button ref={closeRef} onClick={onClose} className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100">Fechar</button>
        </div>
        <div className="mb-4 flex items-center gap-2 text-sm">
          {fontePill}
          {debug?.requestedAt && <span className="text-gray-500 dark:text-gray-400">Consultado em {new Date(debug.requestedAt).toLocaleString()}</span>}
        </div>
        {debug?.fonte === 'planilha' && (
          <div className="mb-4 p-2 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-sm">
            Usamos planilha – a API não foi acionada nesta consulta.
          </div>
        )}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Resumo</h3>
            <div className="text-sm space-y-1">
              {debug?.apiResponse && (
                <>
                  <div>code: {debug.apiResponse.code}</div>
                  <div>code_message: {debug.apiResponse.code_message}</div>
                  <div>data_count: {debug.apiResponse.data_count}</div>
                </>
              )}
              {typeof debug?.mappedCount === 'number' && <div>mappedCount: {debug.mappedCount}</div>}
              {debug?.siteReceipts?.length ? (
                <div>
                  site_receipts:
                  <ul className="list-disc ml-5">
                    {debug.siteReceipts.map((s, i) => (
                      <li key={i}><a href={s} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">{s}</a></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {firstPerdcomp && (
                <div className="mt-2">
                  <h4 className="font-medium">Primeiro PER/DCOMP</h4>
                  <div className="text-xs space-y-0.5">
                    <div>perdcomp: {firstPerdcomp.perdcomp}</div>
                    <div>solicitante: {firstPerdcomp.solicitante}</div>
                    <div>tipo_documento: {firstPerdcomp.tipo_documento}</div>
                    <div>tipo_credito: {firstPerdcomp.tipo_credito}</div>
                    <div>data_transmissao: {firstPerdcomp.data_transmissao}</div>
                    <div>situacao: {firstPerdcomp.situacao}</div>
                    <div>situacao_detalhamento: {firstPerdcomp.situacao_detalhamento}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">JSON bruto</h3>
            {debug?.apiResponse ? (
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-[55vh] overflow-auto">{JSON.stringify(debug.apiResponse, null, 2)}</pre>
            ) : (
              <p className="text-sm text-gray-500">Sem resposta da API.</p>
            )}
          </div>
          {debug?.header && (
            <div>
              <h3 className="font-semibold mb-2">Cabeçalho</h3>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-60 overflow-auto">{JSON.stringify(debug.header, null, 2)}</pre>
            </div>
          )}
          {debug?.apiRequest && (
            <div>
              <h3 className="font-semibold mb-2">Requisição</h3>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-60 overflow-auto">{JSON.stringify(debug.apiRequest, null, 2)}</pre>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm">Fechar</button>
          {debug?.apiResponse && (
            <button onClick={handleCopy} className="px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 text-sm">Copiar JSON</button>
          )}
        </div>
      </div>
    </div>
  );
}

