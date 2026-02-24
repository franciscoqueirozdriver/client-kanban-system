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
      <h1 className="text-2xl font-bold mb-6">Importador de Dados (Sheets para Supabase)</h1>
      
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Google Client Email</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded text-black" 
            value={creds.googleClientEmail}
            onChange={e => setCreds({...creds, googleClientEmail: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Google Private Key (PEM)</label>
          <textarea 
            rows={5}
            className="w-full p-2 border rounded text-black font-mono text-xs" 
            value={creds.googlePrivateKey}
            onChange={e => setCreds({...creds, googlePrivateKey: e.target.value})}
            placeholder="-----BEGIN PRIVATE KEY-----..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Spreadsheet ID</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded text-black" 
            value={creds.spreadsheetId}
            onChange={e => setCreds({...creds, spreadsheetId: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Supabase Service Role Key (Admin)</label>
          <input 
            type="password" 
            className="w-full p-2 border rounded text-black" 
            value={creds.supabaseServiceKey}
            onChange={e => setCreds({...creds, supabaseServiceKey: e.target.value})}
          />
        </div>
      </div>

      <button 
        onClick={handleImport}
        disabled={loading}
        className={`px-6 py-2 rounded font-bold text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Importando...' : 'Iniciar Migração'}
      </button>

      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Resultados da Migração</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Tabela</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Sucesso</th>
                <th className="border p-2 text-left">Falhas</th>
                <th className="border p-2 text-left">Mensagem / Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, i) => (
                <tr key={i}>
                  <td className="border p-2 font-medium text-white">{res.table}</td>
                  <td className={`border p-2 font-bold ${res.status === 'sucesso' ? 'text-green-400' : 'text-red-400'}`}>
                    {res.status}
                  </td>
                  <td className="border p-2 text-white">{res.success || 0}</td>
                  <td className="border p-2 text-white">{res.errors || 0}</td>
                  <td className="border p-2 text-xs text-gray-300 max-w-xs overflow-hidden text-ellipsis">
                    {res.message || (res.status === 'erro' ? 'Erro desconhecido' : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
