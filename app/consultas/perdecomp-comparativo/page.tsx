'use client';

import { useState, useEffect, FormEvent } from 'react';

type ValorPorTipo = Record<string, number>;
type ApiBanner = {
  fonte?: 'planilha' | 'api';
  status?: 'ok' | 'erro';
  code?: number;
  code_message?: string;
  elapsed_ms?: number;
  header?: any;
  raw?: any;
  message?: string;
};

interface Empresa {
  nome: string;
  cnpj: string;
  linhas: any[];
  stats?: {
    quantidade: number;
    valorTotal: number;
    valorPorTipo: ValorPorTipo;
    comprovantes: { html: string; pdf: string }[];
  };
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
  const valorPorTipo: ValorPorTipo = {};
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

async function buscar(
  cnpj: string,
  periodoInicio: string,
  periodoFim: string,
  force = false
): Promise<{ linhas: any[]; info: ApiBanner }> {
  try {
    const res = await fetch('/api/infosimples/perdcomp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj, periodoInicio, periodoFim, force }),
    });
    const data = await res.json();
    const linhas = data.linhas || data.itens || [];
    if (data.fonte === 'api' && data.ok && linhas.length) {
      await fetch('/api/perdecomp/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas }),
      });
    }
    const info: ApiBanner = {
      fonte: data.fonte,
      status: data.ok ? 'ok' : 'erro',
      code: data.code,
      code_message: data.code_message,
      elapsed_ms: data.header?.elapsed_time_in_milliseconds,
      header: data.header,
      raw: data.fonte === 'api' ? data : undefined,
      message: data.message,
    };
    return { linhas, info };
  } catch (err: any) {
    return {
      linhas: [],
      info: { status: 'erro', message: err.message },
    };
  }
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
  const [loading, setLoading] = useState(false);
  const [apiInfo, setApiInfo] = useState<ApiBanner | null>(null);
  const descricao =
    'Compare até 4 CNPJs (Cliente + 3 concorrentes) nos últimos 5 anos. Use os dados já existentes na planilha sempre que possível.';

  useEffect(() => {
    const end = new Date(periodoFim);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 5);
    setPeriodoInicio(start.toISOString().slice(0, 10));
  }, [periodoFim]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const empresas = [cliente, ...concorrentes];
    const atualizadas: Empresa[] = [];
    let lastInfo: ApiBanner | null = null;
    for (const emp of empresas) {
      if (!emp.cnpj) {
        atualizadas.push(emp);
        continue;
      }
      const { linhas, info } = await buscar(emp.cnpj, periodoInicio, periodoFim);
      lastInfo = info;
      const stats = computeStats(linhas);
      atualizadas.push({ ...emp, linhas, stats, ultima: stats.ultima });
    }
    setCliente(atualizadas[0]);
    setConcorrentes(atualizadas.slice(1));
    setApiInfo(lastInfo);
    setLoading(false);
  };

  const handleForce = async (idx: number) => {
    const empresas = [cliente, ...concorrentes];
    const emp = empresas[idx];
    if (!emp.cnpj) return;
    const { linhas, info } = await buscar(emp.cnpj, periodoInicio, periodoFim, true);
    const stats = computeStats(linhas);
    const atualizado = { ...emp, linhas, stats, ultima: stats.ultima };
    if (idx === 0) setCliente(atualizado);
    else {
      const arr = [...concorrentes];
      arr[idx - 1] = atualizado;
      setConcorrentes(arr);
    }
    setApiInfo(info);
  };

  const renderCol = (emp: Empresa, idx: number) => (
    <div
      key={idx}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
    >
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
        {emp.nome || '—'} {emp.cnpj && `(${emp.cnpj})`}
      </h3>
      {emp.ultima && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Última consulta: {emp.ultima}
          <button
            type="button"
            className="ml-2 text-sm text-violet-700 dark:text-violet-300 underline"
            onClick={() => handleForce(idx)}
          >
            Fazer nova consulta
          </button>
        </p>
      )}
      {emp.stats && (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Quantidade:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {emp.stats.quantidade}
            </span>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Valor Total:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {emp.stats.valorTotal.toFixed(2)}
            </span>
          </p>
          <div>
            {(
              Object.entries((emp.stats.valorPorTipo ?? {}) as ValorPorTipo) as [string, number][]
            ).map(([tipo, val]) => (
              <p key={tipo} className="text-sm text-slate-700 dark:text-slate-300">
                {tipo}: {(typeof val === 'number' ? val : Number(val) || 0).toFixed(2)}
              </p>
            ))}
          </div>
          <div className="mt-1 space-y-1">
            {emp.stats.comprovantes.map((c: any, i: number) => (
              <div key={i} className="flex gap-2 text-sm">
                {c.html && (
                  <a
                    href={c.html}
                    target="_blank"
                    className="text-violet-700 dark:text-violet-300 underline"
                  >
                    HTML
                  </a>
                )}
                {c.pdf && (
                  <a
                    href={c.pdf}
                    target="_blank"
                    className="text-violet-700 dark:text-violet-300 underline"
                  >
                    PDF
                  </a>
                )}
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
      <form onSubmit={handleSubmit} className="grid gap-2">
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{descricao}</p>
        <input
          className="border p-1"
          placeholder="CNPJ do Cliente"
          value={cliente.cnpj}
          onChange={(e) =>
            setCliente({ ...cliente, cnpj: e.target.value.replace(/\D/g, '') })
          }
        />
        <input
          className="border p-1"
          placeholder="Nome do Cliente"
          value={cliente.nome}
          onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
        />
        {concorrentes.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="border p-1 flex-1"
              placeholder={`CNPJ Concorrente ${i + 1}`}
              value={c.cnpj}
              onChange={(e) => {
                const arr = [...concorrentes];
                arr[i] = { ...arr[i], cnpj: e.target.value.replace(/\D/g, '') };
                setConcorrentes(arr);
              }}
            />
            <input
              className="border p-1 flex-1"
              placeholder={`Nome Concorrente ${i + 1}`}
              value={c.nome}
              onChange={(e) => {
                const arr = [...concorrentes];
                arr[i] = { ...arr[i], nome: e.target.value };
                setConcorrentes(arr);
              }}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <div className="flex flex-col">
            <label className="text-sm text-slate-700 dark:text-slate-300">Período Fim</label>
            <input
              type="date"
              className="border p-1"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-slate-700 dark:text-slate-300">Período Início</label>
            <input
              type="date"
              className="border p-1"
              value={periodoInicio}
              readOnly
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex items-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Pesquisando…' : 'Pesquisar'}
        </button>
      </form>

      {apiInfo && (
        <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Resposta da {apiInfo.fonte === 'api' ? 'API' : 'Planilha'}
              </h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {apiInfo.status === 'ok'
                  ? 'Consulta realizada com sucesso.'
                  : 'Houve um problema na consulta.'}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {typeof apiInfo.code !== 'undefined' && (
                  <>Código: {apiInfo.code} — {apiInfo.code_message || '—'}</>
                )}
                {typeof apiInfo.elapsed_ms === 'number' && (
                  <> · Tempo: {apiInfo.elapsed_ms} ms</>
                )}
              </p>
            </div>
            <div className="ml-4 flex items-start gap-4">
              {apiInfo.raw && (
                <details>
                  <summary className="cursor-pointer text-xs text-violet-700 dark:text-violet-300">
                    Ver detalhes
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 dark:bg-slate-800 p-2 text-xs text-slate-800 dark:text-slate-100">
{JSON.stringify(apiInfo.raw, null, 2)}
                  </pre>
                </details>
              )}
              <button
                type="button"
                onClick={() => setApiInfo(null)}
                className="text-xs text-slate-600 dark:text-slate-400"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {empresasCombinadas.map((e, idx) => renderCol(e, idx))}
      </div>
    </div>
  );
}
