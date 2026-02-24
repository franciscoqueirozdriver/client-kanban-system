'use client';

import { useState } from 'react';

export default function ImportPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [creds, setCreds] = useState({
    googleClientEmail: '',
    googlePrivateKey: '',
    spreadsheetId: '',
    supabaseUrl: 'https://bdtjwveighwxvdjeumwt.supabase.co',
    supabaseServiceKey: ''
  });

  const handleImport = async () => {
    setLoading(true);
    setResults([]);
    try {
      const response = await fetch('/api/admin/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await response.json();
      if (data.results) {
        setResults(data.results);
      } else if (data.error) {
        alert('Erro: ' + data.error);
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Importador de Dados (Sheets para Supabase)</h1>
        <a href="/admin/import/logs" className="text-blue-500 hover:underline">Ver Histórico de Logs →</a>
      </div>

      <div className="bg-blue-900/20 border border-blue-800 p-4 rounded mb-6 text-sm text-blue-200">
        <strong>Dica:</strong> Se as variáveis de ambiente já estiverem configuradas na Vercel, você pode deixar os campos abaixo vazios e clicar diretamente em "Iniciar Migração".
      </div>
      
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Google Client Email (Opcional)</label>
          <input 
            type="text" 
            className="w-full p-2 border border-gray-700 rounded bg-gray-900 text-white" 
            value={creds.googleClientEmail}
            onChange={e => setCreds({...creds, googleClientEmail: e.target.value})}
            placeholder="Deixe vazio para usar a Vercel"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Google Private Key (PEM) (Opcional)</label>
          <textarea 
            rows={3}
            className="w-full p-2 border border-gray-700 rounded bg-gray-900 text-white font-mono text-xs" 
            value={creds.googlePrivateKey}
            onChange={e => setCreds({...creds, googlePrivateKey: e.target.value})}
            placeholder="-----BEGIN PRIVATE KEY-----... (Deixe vazio para usar a Vercel)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Spreadsheet ID (Opcional)</label>
          <input 
            type="text" 
            className="w-full p-2 border border-gray-700 rounded bg-gray-900 text-white" 
            value={creds.spreadsheetId}
            onChange={e => setCreds({...creds, spreadsheetId: e.target.value})}
            placeholder="Deixe vazio para usar a Vercel"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Supabase Service Role Key (Admin) (Opcional)</label>
          <input 
            type="password" 
            className="w-full p-2 border border-gray-700 rounded bg-gray-900 text-white" 
            value={creds.supabaseServiceKey}
            onChange={e => setCreds({...creds, supabaseServiceKey: e.target.value})}
            placeholder="Deixe vazio para usar a Vercel"
          />
        </div>
      </div>

      <button 
        onClick={handleImport}
        disabled={loading}
        className={`w-full py-3 rounded font-bold text-white transition-colors ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Processando Migração...' : 'Iniciar Migração (Usar Credenciais da Vercel)'}
      </button>

      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Resultados da Migração</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800 text-gray-200">
                  <th className="border border-gray-700 p-2 text-left">Tabela</th>
                  <th className="border border-gray-700 p-2 text-left">Status</th>
                  <th className="border border-gray-700 p-2 text-right">Sucesso</th>
                  <th className="border border-gray-700 p-2 text-right">Falhas</th>
                  <th className="border border-gray-700 p-2 text-left">Mensagem / Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="border border-gray-700 p-2 font-medium text-white">{res.table}</td>
                    <td className={`border border-gray-700 p-2 font-bold ${res.status === 'sucesso' ? 'text-green-400' : 'text-red-400'}`}>
                      {res.status}
                    </td>
                    <td className="border border-gray-700 p-2 text-right text-white">{res.success || 0}</td>
                    <td className="border border-gray-700 p-2 text-right text-white">{res.errors || 0}</td>
                    <td className="border border-gray-700 p-2 text-xs text-gray-400 max-w-xs overflow-hidden text-ellipsis">
                      {res.message || (res.status === 'erro' ? 'Erro desconhecido' : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
