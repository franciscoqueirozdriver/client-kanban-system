'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { onlyDigits, isValidCNPJ } from '@/utils/cnpj';
import { toMatrizCNPJ } from '@/utils/cnpj-matriz';

type CnpjItem = {
  id: number;
  cnpj: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO: REMOVE THIS ENTIRE ROUTE - This is a temporary feature for batch processing PER/DCOMP queries.
export default function PerdcompBatch() {
  const [cnpjs, setCnpjs] = useState<CnpjItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateCnpjStatus = (id: number, status: CnpjItem['status'], message?: string) => {
    setCnpjs(prev => prev.map(item => item.id === id ? { ...item, status, message } : item));
  };

  const handleFileParse = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (json.length === 0) {
        alert('Planilha vazia ou em formato inválido.');
        return;
      }

      const header = (json[0] as string[]).map(h => h ? h.trim().toUpperCase() : '');
      const cnpjIndex = header.indexOf('CNPJ');
      const dataRows = json.slice(1);

      const extractedCnpjs = dataRows.map((row: any) => {
          const rawCnpj = cnpjIndex !== -1 ? row[cnpjIndex] : row[0];
          const cleanedCnpj = onlyDigits(String(rawCnpj || ''));
          return cleanedCnpj.length > 0 ? cleanedCnpj : null;
      }).filter(Boolean) as string[];

      const uniqueCnpjs = [...new Set(extractedCnpjs)];

      setCnpjs(uniqueCnpjs.map((cnpj, i) => ({ id: i, cnpj, status: 'pending' })));
      setProgress(0);
    };
    reader.onerror = () => {
        alert('Erro ao ler o arquivo.');
    }
    reader.readAsBinaryString(file);
  };

  const handleStartProcessing = async () => {
    setIsLoading(true);

    for (const item of cnpjs) {
      updateCnpjStatus(item.id, 'loading');
      setProgress(prev => prev + 1);

      const matrizCnpj = toMatrizCNPJ(item.cnpj);
      if (!isValidCNPJ(matrizCnpj)) {
        updateCnpjStatus(item.id, 'error', 'CNPJ inválido após normalização');
        await sleep(50); // Small delay for UI update
        continue;
      }

      try {
        const res = await fetch('/api/infosimples/perdcomp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cnpj: matrizCnpj,
            force: true,
            clienteId: `LOTE-TEMP-${matrizCnpj}`,
            nomeEmpresa: `Lote-${matrizCnpj}`,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: 'Erro desconhecido na API' }));
          throw new Error(errorData.message || `Erro ${res.status}`);
        }

        const data = await res.json();
        const count = data.perdcompResumo?.totalSemCancelamento ?? 0;
        updateCnpjStatus(item.id, 'success', `Sucesso. ${count} registros encontrados.`);

      } catch (error: any) {
        updateCnpjStatus(item.id, 'error', error.message || 'Falha na consulta');
      }

      await sleep(1000); // Wait 1 second before next request
    }

    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-4 text-gray-900 dark:text-gray-100">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Consulta de PER/DCOMP em Lote (Temporário)</h1>
        <p className="mb-4 text-yellow-700 bg-yellow-100 p-3 rounded-md border border-yellow-200">
          <strong>Atenção:</strong> Esta é uma funcionalidade temporária criada para uma necessidade específica.
          Não deve ser considerada parte permanente do sistema e será removida em breve.
        </p>

        <div className="mb-6">
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            1. Carregar Planilha (CSV ou XLSX)
          </label>
          <p className="text-xs text-gray-500 mb-2">A planilha deve conter uma coluna com o cabeçalho "CNPJ" ou ter os CNPJs na primeira coluna.</p>
          <input
            id="file-upload"
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => {
              if (e.target.files) {
                handleFileParse(e.target.files[0]);
              }
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
            disabled={isLoading}
          />
        </div>

        {cnpjs.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">
                    {progress > 0 ? `Progresso: ${progress} de ${cnpjs.length}` : `${cnpjs.length} CNPJs carregados`}
                </h2>
                <button
                onClick={handleStartProcessing}
                disabled={isLoading || progress > 0}
                className="px-6 py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 disabled:bg-gray-400"
                >
                {isLoading ? 'Consultando...' : (progress > 0 ? 'Concluído' : '2. Iniciar Consultas')}
                </button>
            </div>

            {progress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
                    <div className="bg-violet-600 h-2.5 rounded-full" style={{ width: `${(progress / cnpjs.length) * 100}%` }}></div>
                </div>
            )}

            <div className="mt-6 max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {cnpjs.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{item.cnpj}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            item.status === 'success' ? 'bg-green-100 text-green-800' :
                            item.status === 'error' ? 'bg-red-100 text-red-800' :
                            item.status === 'loading' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}