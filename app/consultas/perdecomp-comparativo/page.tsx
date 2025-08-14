// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fiveYearsAgo(dateStr: string) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

const empty = { cnpj: '', nome: '', cadastro: null };

export default function Page() {
  const [cliente, setCliente] = useState({ ...empty });
  const [concorrentes, setConcorrentes] = useState([] as any[]);
  const [periodoFim, setPeriodoFim] = useState(todayISO());
  const [periodoInicio, setPeriodoInicio] = useState(fiveYearsAgo(todayISO()));
  const [resultados, setResultados] = useState({} as any);

  useEffect(() => {
    setPeriodoInicio(fiveYearsAgo(periodoFim));
  }, [periodoFim]);

  const participantes = [cliente, ...concorrentes];

  const buscarCadastro = async (valor: string, idx?: number) => {
    if (!valor) return;
    const res = await fetch(`/api/clientes/buscar?q=${valor}`);
    const json = await res.json();
    if (json.results && json.results.length) {
      const item = json.results[0];
      const cnpj = (item['CNPJ Empresa'] || '').replace(/\D/g, '');
      const nome = item['Nome da Empresa'] || '';
      const novo = { cnpj, nome, cadastro: item };
      if (idx === undefined) setCliente(novo);
      else setConcorrentes((prev) => {
        const arr = [...prev];
        arr[idx] = novo;
        return arr;
      });
    }
  };

  const consultar = async () => {
    const novos: any = {};
    for (const part of participantes.filter((p) => p && p.cnpj)) {
      const res = await fetch('/api/infosimples/perdcomp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: part.cnpj, periodoInicio, periodoFim }),
      });
      const json = await res.json();
      if (json.fonte === 'api' && json.linhas?.length) {
        await fetch('/api/perdecomp/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linhas: json.linhas }),
        });
      }
      novos[part.cnpj] = json.agregado || {};
    }
    setResultados(novos);
  };

  const novaConsulta = async (part: any) => {
    const res = await fetch('/api/infosimples/perdcomp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj: part.cnpj, periodoInicio, periodoFim, force: true }),
    });
    const json = await res.json();
    if (json.fonte === 'api' && json.linhas?.length) {
      await fetch('/api/perdecomp/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas: json.linhas }),
      });
    }
    setResultados((r: any) => ({ ...r, [part.cnpj]: json.agregado || {} }));
  };

  const enriquecer = async (part: any) => {
    await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: { company: part.nome, cnpj: part.cnpj } }),
    });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">PER/DCOMP (Comparativo)</h1>
      <div className="space-y-2">
        <div className="p-2 border rounded space-y-1">
          <label className="font-semibold">Cliente</label>
          <input className="w-full p-1 border" placeholder="CNPJ" value={cliente.cnpj} onChange={(e) => setCliente({ ...cliente, cnpj: e.target.value })} onBlur={(e) => buscarCadastro(e.target.value)} />
          <input className="w-full p-1 border" placeholder="Nome" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} onBlur={(e) => buscarCadastro(e.target.value)} />
          <button className="text-sm text-blue-600" onClick={() => enriquecer(cliente)}>Enriquecer Dados do Cadastro</button>
        </div>
        {concorrentes.map((c, i) => (
          <div key={i} className="p-2 border rounded space-y-1">
            <label className="font-semibold">Concorrente {i + 1}</label>
            <input className="w-full p-1 border" placeholder="CNPJ" value={c?.cnpj || ''} onChange={(e) => {
              const arr = [...concorrentes];
              arr[i] = { ...(arr[i] || {}), cnpj: e.target.value };
              setConcorrentes(arr);
            }} onBlur={(e) => buscarCadastro(e.target.value, i)} />
            <input className="w-full p-1 border" placeholder="Nome" value={c?.nome || ''} onChange={(e) => {
              const arr = [...concorrentes];
              arr[i] = { ...(arr[i] || {}), nome: e.target.value };
              setConcorrentes(arr);
            }} onBlur={(e) => buscarCadastro(e.target.value, i)} />
            <button className="text-sm text-blue-600" onClick={() => enriquecer(c)}>Enriquecer Dados do Cadastro</button>
          </div>
        ))}
        {concorrentes.length < 3 && (
          <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => setConcorrentes([...concorrentes, { ...empty }])}>Adicionar Concorrente</button>
        )}
      </div>
      <div className="flex gap-2">
        <div>
          <label>Período Fim</label>
          <input type="date" className="border p-1" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
        </div>
        <div>
          <label>Período Início</label>
          <input type="date" className="border p-1" value={periodoInicio} readOnly />
        </div>
      </div>
      <button className="px-3 py-1 bg-purple-600 text-white rounded" onClick={consultar}>Consultar / Atualizar Comparação</button>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {participantes.filter((p) => p && p.cnpj).map((p, i) => {
          const r = resultados[p.cnpj] || {};
          return (
            <div key={i} className="p-3 border rounded shadow">
              <h3 className="font-semibold">{p.nome || '—'}<br />{p.cnpj}</h3>
              {r.ultimaConsulta && <p className="text-sm">Última consulta em: {new Date(r.ultimaConsulta).toLocaleDateString()}</p>}
              {r.quantidade !== undefined && (
                <div className="text-sm space-y-1 mt-2">
                  <p>Quantidade: {r.quantidade}</p>
                  <p>Valor Total: {r.valorTotal || 0}</p>
                  {r.valorPorTipo && (
                    <table className="text-xs">
                      <tbody>
                        {Object.entries(r.valorPorTipo).map(([tipo, val]: any) => (
                          <tr key={tipo}><td className="pr-2">{tipo}</td><td>{val as any}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {r.comprovantes && r.comprovantes.length > 0 && (
                    <ul className="list-disc ml-4">
                      {r.comprovantes.map((c: any, idx: number) => (
                        <li key={idx}><a href={c.html || c.pdf} target="_blank" className="text-blue-600">Comprovante {idx + 1}</a></li>
                      ))}
                    </ul>
                  )}
                  {r.ultimaConsulta && (
                    <button className="text-xs text-purple-700 mt-2" onClick={() => novaConsulta(p)}>Fazer nova consulta</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
