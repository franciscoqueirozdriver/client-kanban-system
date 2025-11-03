'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import SummaryCard from '@/components/SummaryCard';
import { cn } from '@/lib/cn';
import {
  Scale,
  Users,
  CircleDollarSign,
  TrendingUp,
  Clock,
} from 'lucide-react';

const SELECT_BASE_CLASSES =
  'flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

const COLORS = ['#6B4EFF', '#9B8CFF', '#22D3EE', '#34D399', '#F59E0B', '#EC4899'];

const formatDate = (value: string) => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('pt-BR');
};

type ProspeccaoFilters = {
  q: string;
  valor: [number, number];
  tempo: 'all' | 'lt1' | 'btw13' | 'gt3';
  aju: 'all' | 'yes' | 'no';
  tipo: 'all' | 'FGTS' | 'Previdenciário' | 'CIDA' | 'Demais Débitos';
  uf: 'all' | string;
  receita: string;
};

type ProspeccaoRow = {
  cnpj: string;
  nome: string;
  valor: number;
  tipo: string | null;
  data: string;
  ajuizado: boolean;
  uf: string;
  inscricao: string;
  receitaPrincipal: string | null;
};

type ProspeccaoKpis = {
  total: number;
  soma: number;
  media: number;
  pctAju: number;
  recentes: number;
};

const DEFAULT_FILTERS: ProspeccaoFilters = {
  q: '',
  valor: [0, 5_000_000],
  tempo: 'all',
  aju: 'all',
  tipo: 'all',
  uf: 'all',
  receita: '',
};

const INITIAL_KPIS: ProspeccaoKpis = {
  total: 0,
  soma: 0,
  media: 0,
  pctAju: 0,
  recentes: 0,
};

const UF_OPTIONS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

function formatCnpj(value: string) {
  if (!value) {
    return '—';
  }
  const onlyDigits = value.replace(/\D/g, '').padStart(14, '0');
  return `${onlyDigits.slice(0, 2)}.${onlyDigits.slice(2, 5)}.${onlyDigits.slice(5, 8)}/${onlyDigits.slice(8, 12)}-${onlyDigits.slice(12)}`;
}

export default function PainelPgfnProspecao() {
  const [filters, setFilters] = useState<ProspeccaoFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<ProspeccaoRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [kpis, setKpis] = useState<ProspeccaoKpis>(INITIAL_KPIS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFilterChange = <Key extends keyof ProspeccaoFilters>(key: Key, value: ProspeccaoFilters[Key]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRangeChange = (index: 0 | 1, raw: string) => {
    const parsed = Number(raw.replace(/[^\d]/g, ''));
    const value = Number.isNaN(parsed) ? 0 : parsed;
    setFilters((prev) => {
      const next: [number, number] = [...prev.valor];
      next[index] = value;
      if (next[0] > next[1]) {
        next.sort((a, b) => a - b);
      }
      return {
        ...prev,
        valor: [next[0], next[1]],
      };
    });
  };

  const fetchData = useCallback(async (currentFilters: ProspeccaoFilters) => {
    setLoading(true);
    setError(null);
    try {
      const receitaParam = currentFilters.receita.trim();
      const params = new URLSearchParams({
        q: currentFilters.q.trim(),
        min: String(currentFilters.valor[0]),
        max: String(currentFilters.valor[1]),
        tempo: currentFilters.tempo,
        aju: currentFilters.aju,
        tipo: currentFilters.tipo,
        uf: currentFilters.uf,
        receita: receitaParam ? receitaParam : 'all',
        page: '1',
        size: '100',
      });

      if (!currentFilters.q.trim()) {
        params.set('q', '');
      }

      const qs = params.toString();

      const [searchResponse, kpisResponse] = await Promise.all([
        fetch(`/api/pgfn/search?${qs}`, { cache: 'no-store' }),
        fetch(`/api/pgfn/kpis?${qs}`, { cache: 'no-store' }),
      ]);

      if (!searchResponse.ok) {
        throw new Error(`Falha ao carregar inscrições: ${searchResponse.status}`);
      }

      if (!kpisResponse.ok) {
        throw new Error(`Falha ao carregar KPIs: ${kpisResponse.status}`);
      }

      const searchPayload = await searchResponse.json();
      const kpisPayload = await kpisResponse.json();

      const toNumber = (value: unknown) => {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const parseBoolean = (value: unknown) =>
        value === true || value === 't' || value === 'true' || value === 1;

      const normalizedRows: ProspeccaoRow[] = Array.isArray(searchPayload?.rows)
        ? searchPayload.rows.map((row: any) => ({
            cnpj: String(row?.cnpj ?? ''),
            nome: String(row?.nome ?? ''),
            valor: toNumber(row?.valor),
            tipo: row?.tipo ?? null,
            data: String(row?.data ?? ''),
            ajuizado: parseBoolean(row?.ajuizado),
            uf: String(row?.uf ?? ''),
            inscricao: String(row?.inscricao ?? ''),
            receitaPrincipal: row?.receita_principal ?? null,
          }))
        : [];

      setRows(normalizedRows);
      setTotalRows(Math.max(0, toNumber(searchPayload?.total ?? normalizedRows.length)));

      setKpis({
        total: Math.max(0, toNumber(kpisPayload?.total)),
        soma: toNumber(kpisPayload?.soma),
        media: toNumber(kpisPayload?.media),
        pctAju: toNumber(kpisPayload?.pct_aju) / 100,
        recentes: Math.max(0, toNumber(kpisPayload?.recentes)),
      });
    } catch (caughtError) {
      console.error('[PGFN][fetch] erro ao aplicar filtros', caughtError);
      setError('Não foi possível carregar os dados no momento. Tente novamente.');
      setRows([]);
      setTotalRows(0);
      setKpis(INITIAL_KPIS);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApplyFilters = () => {
    void fetchData(filters);
  };

  const handleResetFilters = () => {
    const defaults = { ...DEFAULT_FILTERS };
    setFilters(defaults);
    void fetchData(defaults);
  };

  useEffect(() => {
    void fetchData({ ...DEFAULT_FILTERS });
  }, [fetchData]);

  const creditTypeData = useMemo(() => {
    if (!rows.length) {
      return [];
    }

    const totals = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.tipo?.trim() || 'Não informado';
      totals.set(key, (totals.get(key) ?? 0) + row.valor);
    });

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const faixaValorData = useMemo(() => {
    if (!rows.length) {
      return [];
    }

    const buckets = [
      { faixa: 'Até 250k', min: 0, max: 250_000 },
      { faixa: '250k – 750k', min: 250_000, max: 750_000 },
      { faixa: '750k – 1.5M', min: 750_000, max: 1_500_000 },
      { faixa: '1.5M – 3M', min: 1_500_000, max: 3_000_000 },
      { faixa: 'Acima de 3M', min: 3_000_000, max: Number.POSITIVE_INFINITY },
    ];

    const distribution = buckets.map((bucket) => ({ faixa: bucket.faixa, total: 0 }));

    rows.forEach((row) => {
      const value = row.valor;
      const bucketIndex = buckets.findIndex((bucket) =>
        bucket.max === Number.POSITIVE_INFINITY
          ? value >= bucket.min
          : value >= bucket.min && value < bucket.max,
      );

      if (bucketIndex >= 0) {
        distribution[bucketIndex].total += 1;
      }
    });

    return distribution;
  }, [rows]);

  const topReceitaData = useMemo(() => {
    if (!rows.length) {
      return [];
    }

    const totals = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.receitaPrincipal?.trim() || 'Não informado';
      totals.set(key, (totals.get(key) ?? 0) + row.valor);
    });

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([receita, total]) => ({ receita, total }));
  }, [rows]);

  const kpiCards = useMemo(
    () => [
      {
        id: 'total',
        title: 'Total de Devedores',
        value: kpis.total.toLocaleString('pt-BR'),
        helper: 'Quantidade filtrada',
        icon: Users,
      },
      {
        id: 'soma',
        title: 'Soma das Dívidas',
        value: formatCurrency(kpis.soma),
        helper: 'Valor consolidado',
        icon: CircleDollarSign,
      },
      {
        id: 'pctAju',
        title: '% Judicializados',
        value: formatPercent(kpis.pctAju),
        helper: 'Com ajuizamento ativo',
        icon: Scale,
      },
      {
        id: 'media',
        title: 'Valor Médio',
        value: formatCurrency(kpis.media),
        helper: 'Ticket médio por inscrição',
        icon: TrendingUp,
      },
      {
        id: 'recentes',
        title: 'Dívidas Recentes',
        value: kpis.recentes.toLocaleString('pt-BR'),
        helper: 'Últimos 12 meses',
        icon: Clock,
      },
    ],
    [kpis],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Prospecção</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Painel PGFN</h1>
        <p className="text-sm text-muted-foreground">
          Explore inscrições devedoras da PGFN, monitore indicadores chave e priorize oportunidades de atuação.
        </p>
      </header>

      <Card className="rounded-3xl border-border bg-card shadow-soft">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-xl font-semibold">Filtros avançados</CardTitle>
          <p className="text-sm text-muted-foreground">
            Refine a base por inscrição, valor consolidado, tempo de dívida, judicialização, tipo de crédito, UF e receita principal.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="pgfn-search" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Busca (CNPJ, Nome ou Inscrição)
              </label>
              <Input
                id="pgfn-search"
                placeholder="Ex.: 12.345.678/0001-99"
                value={filters.q}
                onChange={(event) => handleFilterChange('q', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Faixa de valor (R$)
              </label>
              <div className="flex items-center gap-3">
                <Input
                  inputMode="numeric"
                  value={filters.valor[0]}
                  onChange={(event) => handleRangeChange(0, event.target.value)}
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  inputMode="numeric"
                  value={filters.valor[1]}
                  onChange={(event) => handleRangeChange(1, event.target.value)}
                />
              </div>
              <input
                type="range"
                min={0}
                max={10_000_000}
                step={50_000}
                value={filters.valor[0]}
                onChange={(event) => handleRangeChange(0, event.target.value)}
                className="w-full accent-primary"
              />
              <input
                type="range"
                min={0}
                max={10_000_000}
                step={50_000}
                value={filters.valor[1]}
                onChange={(event) => handleRangeChange(1, event.target.value)}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pgfn-tempo" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tempo da dívida
              </label>
              <select
                id="pgfn-tempo"
                className={SELECT_BASE_CLASSES}
                value={filters.tempo}
                onChange={(event) => handleFilterChange('tempo', event.target.value as ProspeccaoFilters['tempo'])}
              >
                <option value="all">Todos os períodos</option>
                <option value="lt1">Até 1 ano</option>
                <option value="btw13">Entre 1 e 3 anos</option>
                <option value="gt3">Acima de 3 anos</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="pgfn-aju" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Judicialização
              </label>
              <select
                id="pgfn-aju"
                className={SELECT_BASE_CLASSES}
                value={filters.aju}
                onChange={(event) => handleFilterChange('aju', event.target.value as ProspeccaoFilters['aju'])}
              >
                <option value="all">Todos</option>
                <option value="yes">Somente ajuizados</option>
                <option value="no">Não ajuizados</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="pgfn-tipo" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo de crédito
              </label>
              <select
                id="pgfn-tipo"
                className={SELECT_BASE_CLASSES}
                value={filters.tipo}
                onChange={(event) => handleFilterChange('tipo', event.target.value as ProspeccaoFilters['tipo'])}
              >
                <option value="all">Todos</option>
                <option value="FGTS">FGTS</option>
                <option value="Previdenciário">Previdenciário</option>
                <option value="CIDA">CIDA</option>
                <option value="Demais Débitos">Demais Débitos</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="pgfn-uf" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                UF
              </label>
              <select
                id="pgfn-uf"
                className={SELECT_BASE_CLASSES}
                value={filters.uf}
                onChange={(event) => handleFilterChange('uf', event.target.value as ProspeccaoFilters['uf'])}
              >
                <option value="all">Todas</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-3">
              <label htmlFor="pgfn-receita" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Receita principal
              </label>
              <Input
                id="pgfn-receita"
                placeholder="Digite parte do nome da receita"
                value={filters.receita}
                onChange={(event) => handleFilterChange('receita', event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleApplyFilters} disabled={loading}>
              {loading ? 'Aplicando filtros...' : 'Aplicar filtros'}
            </Button>
            <Button type="button" variant="outline" onClick={handleResetFilters} disabled={loading}>
              Limpar
            </Button>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Carregando inscrições…' : `${totalRows.toLocaleString('pt-BR')} inscrições encontradas.`}
            </p>
            {error ? (
              <p className="text-xs font-medium text-destructive">{error}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-5">
        {kpiCards.map(({ id, title, value, helper, icon: Icon }) => (
          <SummaryCard
            key={id}
            title={
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {title}
              </span>
            }
            value={value}
            helper={helper}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-3xl border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Distribuição por tipo de crédito</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {creditTypeData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={creditTypeData} innerRadius={60} outerRadius={100} paddingAngle={6}>
                    {creditTypeData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={32} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatCurrency(value as number), name]}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum dado para exibir.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Faixa de valor consolidado</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {faixaValorData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faixaValorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value.toLocaleString('pt-BR')} inscrições`, 'Total']}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum dado para exibir.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top receitas principais (valor consolidado)</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {topReceitaData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topReceitaData}
                  layout="vertical"
                  margin={{ top: 16, left: 12, right: 16, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="receita"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    width={140}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), 'Valor acumulado']}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="total" radius={[8, 8, 8, 8]} fill="hsl(var(--secondary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum dado para exibir.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border-border bg-card shadow-soft">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold">Inscrições selecionadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualize dados cadastrais, valores consolidados, receita principal e situação de judicialização das inscrições filtradas.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                {[
                  'CNPJ',
                  'Nome',
                  'Valor',
                  'Tipo',
                  'Data',
                  'Ajuizado',
                  'Receita Principal',
                  'UF',
                  'Ações',
                ].map((header) => (
                  <th key={header} className="bg-muted/40 px-3 py-2 text-left font-semibold first:rounded-l-xl last:rounded-r-xl">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr
                    key={`${row.inscricao || row.cnpj}-${row.data}`}
                    className="rounded-2xl border border-border/70 bg-card/80 shadow-sm"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{formatCnpj(row.cnpj)}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{row.nome}</td>
                    <td className="px-3 py-3 font-semibold text-primary">{formatCurrency(row.valor)}</td>
                    <td className="px-3 py-3 text-foreground">{row.tipo ?? '—'}</td>
                    <td className="px-3 py-3 text-foreground">{formatDate(row.data)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                          row.ajuizado
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.ajuizado ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {row.receitaPrincipal ? row.receitaPrincipal : '—'}
                    </td>
                    <td className="px-3 py-3 text-foreground">{row.uf}</td>
                    <td className="px-3 py-3">
                      <Button variant="outline" size="sm">
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {loading
                      ? 'Carregando inscrições filtradas…'
                      : 'Nenhuma inscrição encontrada para os filtros informados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
