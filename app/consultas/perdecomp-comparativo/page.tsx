'use client';

import { useState, useEffect } from 'react';

interface Empresa {
  nome: string;
  cnpj: string;
  linhas: any[];
  stats?: any;
  ultima?: string;
}

const HEADER_INDEX = {
  tipo: 4,
  valor: 8,
  comprovanteHtml: 15,
  comprovantePdf: 16,
  dataConsulta: 17,
};

function computeStats(linhas: any[]) {
  const quantidade = linhas.length;
  let valorTotal = 0;
  const valorPorTipo: Record<string, number> = {};
  const comprovantes: { html: string; pdf: string }[] = [];
  let ultima = '';
  linhas.forEach((l) => {
    const tipo = l[HEADER_INDEX.tipo] || '';
    const valor = parseFloat(l[HEADER_INDEX.valor] || '0');
    valorTotal += valor;
    valorPorTipo[tipo] = (valorPorTipo[tipo] || 0) + valor;
    comprovantes.push({ html: l[HEADER_INDEX.comprovanteHtml], pdf: l[HEADER_INDEX.comprovantePdf] });
    const d = l[HEADER_INDEX.dataConsulta] || '';
    if (d && d > ultima) ultima = d;
  });
  return { quantidade, valorTotal, valorPorTipo, comprovantes, ultima };
}

async function buscar(cnpj: string, periodoInicio: string, periodoFim: string, force = false) {
  const res = await fetch('/api/infosimples/perdcomp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cnpj, periodoInicio, periodoFim, force }),
  });
  const data = await res.json();
  const linhas = data.linhas || data.itens || [];
  if (data.fonte === 'api' && linhas.length) {
    await fetch('/api/perdecomp/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linhas }),
    });
  }
  return linhas;
}

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const five = fiveYearsAgo.toISOString().slice(0, 10);

  const [cliente, setCliente] = useState<Empresa>({ nome: '', cnpj: '', linhas: [] });
  const [concorrentes, setConcorrentes] = useState<Empresa[]>([
    { nome: '', cnpj: '', linhas: [] },
    { nome: '', cnpj: '', linhas: [] },
    { nome: '', cnpj: '', linhas: [] },
  ]);
  const [periodoFim, setPeriodoFim] = useState(today);
  const [periodoInicio, setPeriodoInicio] = useState(five);

  useEffect(() => {
    const end = new Date(periodoFim);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 5);
    setPeriodoInicio(start.toISOString().slice(0, 10));
  }, [periodoFim]);

  const handleConsultar = async () => {
    const empresas = [cliente, ...concorrentes];
    const atualizadas = await Promise.all(
      empresas.map(async (emp) => {
        if (!emp.cnpj) return emp;
        const linhas = await buscar(emp.cnpj, periodoInicio, periodoFim);
        const stats = computeStats(linhas);
        return { ...emp, linhas, stats, ultima: stats.ultima };
      })
    );
    setCliente(atualizadas[0]);
    setConcorrentes(atualizadas.slice(1));
  };

  const handleForce = async (idx: number) => {
    const empresas = [cliente, ...concorrentes];
    const emp = empresas[idx];
    if (!emp.cnpj) return;
    const linhas = await buscar(emp.cnpj, periodoInicio, periodoFim, true);
    const stats = computeStats(linhas);
    const atualizado = { ...emp, linhas, stats, ultima: stats.ultima };
    if (idx === 0) setCliente(atualizado);
    else {
      const arr = [...concorrentes];
      arr[idx - 1] = atualizado;
      setConcorrentes(arr);
    }
  };

  const renderCol = (emp: Empresa, idx: number) => (
    <div key={idx} className="border rounded p-2">
      <h3 className="font-bold">{emp.nome || '—'} {emp.cnpj && `(${emp.cnpj})`}</h3>
      {emp.ultima && (
        <p className="text-sm">Última consulta: {emp.ultima}
          <button className="ml-2 text-blue-500 underline" onClick={() => handleForce(idx)}>Fazer nova consulta</button>
        </p>
      )}
      {emp.stats && (
        <div className="mt-2 text-sm">
          <p>Quantidade: {emp.stats.quantidade}</p>
          <p>Valor Total: {emp.stats.valorTotal.toFixed(2)}</p>
          <div>
            {Object.entries(emp.stats.valorPorTipo).map(([tipo, val]) => (
              <p key={tipo}>{tipo}: {val.toFixed(2)}</p>
            ))}
          </div>
          <div>
            {emp.stats.comprovantes.map((c: any, i: number) => (
              <div key={i} className="flex gap-2">
                {c.html && <a href={c.html} target="_blank" className="text-blue-500">HTML</a>}
                {c.pdf && <a href={c.pdf} target="_blank" className="text-blue-500">PDF</a>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const empresasCombinadas = [cliente, ...concorrentes];

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-2">
        <input className="border p-1" placeholder="CNPJ do Cliente" value={cliente.cnpj} onChange={(e)=>setCliente({...cliente, cnpj:e.target.value.replace(/\D/g,'')})} />
        <input className="border p-1" placeholder="Nome do Cliente" value={cliente.nome} onChange={(e)=>setCliente({...cliente, nome:e.target.value})} />
        {concorrentes.map((c, i)=>(
          <div key={i} className="flex gap-2">
            <input className="border p-1 flex-1" placeholder={`CNPJ Concorrente ${i+1}`} value={c.cnpj} onChange={(e)=>{
              const arr=[...concorrentes];
              arr[i]={...arr[i], cnpj:e.target.value.replace(/\D/g,'')};
              setConcorrentes(arr);
            }} />
            <input className="border p-1 flex-1" placeholder={`Nome Concorrente ${i+1}`} value={c.nome} onChange={(e)=>{
              const arr=[...concorrentes];
              arr[i]={...arr[i], nome:e.target.value};
              setConcorrentes(arr);
            }} />
          </div>
        ))}
        <div className="flex gap-2">
          <div className="flex flex-col">
            <label>Período Fim</label>
            <input type="date" className="border p-1" value={periodoFim} onChange={(e)=>setPeriodoFim(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Período Início</label>
            <input type="date" className="border p-1" value={periodoInicio} readOnly />
          </div>
        </div>
        <button className="bg-blue-500 text-white px-4 py-1 rounded" onClick={handleConsultar}>Consultar/Atualizar Comparação</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {empresasCombinadas.map((e, idx) => renderCol(e, idx))}
      </div>
    </div>
  );
}
