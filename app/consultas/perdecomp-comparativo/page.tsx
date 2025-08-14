'use client';
import { useState } from 'react';

type ContagemPorTipo = Record<string, number>;
interface Resultado {
  cnpj: string;
  nome: string;
  stats: { quantidade: number; porTipoDocumento?: ContagemPorTipo };
  ultimaConsulta?: string;
}

export default function Page() {
  const [cnpj, setCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [resultado, setResultado] = useState<Resultado[]>([]);
  const [banner, setBanner] = useState<any>(null);

  const hoje = new Date();
  const periodoFim = hoje.toISOString().slice(0,10);
  const periodoInicio = new Date(hoje.getFullYear()-5, hoje.getMonth(), hoje.getDate()).toISOString().slice(0,10);

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/infosimples/perdcomp', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ cnpj, periodoInicio, periodoFim })
    });
    const json = await res.json();
    setBanner(json);
    const stats = { quantidade: json.quantidadePerdcomp || 0, porTipoDocumento: json.contagemPorTipoDocumento };
    setResultado([{ cnpj, nome: json.nomeDetectado || nome, stats, ultimaConsulta: json.linhas?.[0]?.Data_Consulta }]);
  }

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col md:flex-row md:items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="cnpj" className="text-slate-900 dark:text-slate-100">CNPJ do Cliente</label>
            <input id="cnpj" value={cnpj} onChange={e=>setCnpj(e.target.value)} className="border p-1" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="nome" className="text-slate-900 dark:text-slate-100">Nome do Cliente</label>
            <input id="nome" value={nome} onChange={e=>setNome(e.target.value)} className="border p-1" />
          </div>
          <button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-50 px-4 py-2">Pesquisar</button>
        </div>
        <p className="text-slate-700 dark:text-slate-300">Comparação PER/DCOMP para os últimos 5 anos.</p>
      </form>

      {banner && (
        <div className="p-4 border rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <p><strong>Fonte:</strong> {banner.fonte}</p>
          {banner.header && (
            <p><strong>Código:</strong> {banner.header.code} - {banner.header.code_message}</p>
          )}
          {banner.nomeDetectado && <p><strong>Nome detectado:</strong> {banner.nomeDetectado}</p>}
          <p><strong>Quantidade:</strong> {banner.quantidadePerdcomp || 0}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {resultado.map((emp, idx)=>(
          <div key={idx} className="p-4 border rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{emp.nome}</h3>
            <p className="text-sm">{emp.cnpj}</p>
            {emp.ultimaConsulta && <p className="text-xs">Última consulta: {emp.ultimaConsulta}</p>}
            <p className="mt-2"><strong>Quantidade:</strong> {emp.stats.quantidade}</p>
            <ul className="text-sm mt-2">
              {Object.entries((emp.stats.porTipoDocumento || {}) as ContagemPorTipo).map(([tipo, qtd])=> (
                <li key={tipo}>{tipo}: {qtd}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
