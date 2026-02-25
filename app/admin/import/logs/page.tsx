'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MigrationLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('migration_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar logs:', error);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    }

    fetchLogs();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Logs de Migração</h1>
        <a href="/admin/import" className="text-blue-500 hover:underline">← Voltar para Importação</a>
      </div>

      {loading ? (
        <p>Carregando logs...</p>
      ) : logs.length === 0 ? (
        <p>Nenhum log de migração encontrado.</p>
      ) : (
        <div className="space-y-6">
          {logs.map((log) => (
            <div key={log.id} className="border rounded-lg p-4 bg-gray-900 shadow-sm">
              <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                <div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase mr-2 ${
                    log.status === 'sucesso' ? 'bg-green-600 text-white' : 
                    log.status === 'parcial' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {log.status}
                  </span>
                  <span className="text-sm text-gray-400">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">ID: {log.id}</span>
              </div>

              {log.error_message && (
                <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
                  <strong>Erro Fatal:</strong> {log.error_message}
                </div>
              )}

              {log.results && Array.isArray(log.results) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-gray-300">
                        <th className="p-2 border border-gray-700 text-left">Tabela</th>
                        <th className="p-2 border border-gray-700 text-left">Status</th>
                        <th className="p-2 border border-gray-700 text-right">Sucesso</th>
                        <th className="p-2 border border-gray-700 text-right">Falhas</th>
                        <th className="p-2 border border-gray-700 text-left">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.results.map((res: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-800">
                          <td className="p-2 border border-gray-700 text-gray-200">{res.table}</td>
                          <td className={`p-2 border border-gray-700 font-bold ${
                            res.status === 'sucesso' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {res.status}
                          </td>
                          <td className="p-2 border border-gray-700 text-right text-gray-300">{res.success || 0}</td>
                          <td className="p-2 border border-gray-700 text-right text-gray-300">{res.errors || 0}</td>
                          <td className="p-2 border border-gray-700 text-gray-400 max-w-xs truncate">
                            {res.message || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
