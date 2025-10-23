'use client';

import { useMemo, useState } from 'react';
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

type ProspeccaoFilters = {
  q: string;
  valor: [number, number];
  tempo: 'all' | 'lt1' | 'btw13' | 'gt3';
  aju: 'all' | 'yes' | 'no';
  tipo: 'all' | 'FGTS' | 'Previdenciário' | 'CIDA' | 'Demais Débitos';
  uf: 'all' | string;
};

type ProspeccaoRow = {
  cnpj: string;
  nome: string;
  valor: number;
  tipo: string;
  data: string;
  ajuizado: boolean;
  cnae: string;
  uf: string;
};

const DEFAULT_FILTERS: ProspeccaoFilters = {
  q: '',
  valor: [0, 5_000_000],
  tempo: 'all',
  aju: 'all',
  tipo: 'all',
  uf: 'all',
};

const MOCK_ROWS: ProspeccaoRow[] = [
  {
    cnpj: '12345678000199',
    nome: 'Alfa Tecnologia LTDA',
    valor: 968234.21,
    tipo: 'FGTS',
    data: '2021-09-12',
    ajuizado: true,
    cnae: '6201-5/01',
    uf: 'SP',
  },
  {
    cnpj: '98765432000111',
    nome: 'Beta Construções S/A',
    valor: 1892340.55,
    tipo: 'Previdenciário',
    data: '2020-03-18',
    ajuizado: false,
    cnae: '4120-4/00',
    uf: 'RJ',
  },
  {
    cnpj: '55443322000177',
    nome: 'Cooperativa Gama',
    valor: 423781.9,
    tipo: 'Demais Débitos',
    data: '2019-11-01',
    ajuizado: true,
    cnae: '0141-8/01',
    uf: 'MG',
  },
  {
    cnpj: '00665544000155',
    nome: 'Delta Saúde Integrada',
    valor: 732123.44,
    tipo: 'CIDA',
    data: '2022-01-23',
    ajuizado: false,
    cnae: '8610-1/01',
    uf: 'RS',
  },
];

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
  const onlyDigits = value.replace(/\D/g, '').padStart(14, '0');
  return `${onlyDigits.slice(0, 2)}.${onlyDigits.slice(2, 5)}.${onlyDigits.slice(5, 8)}/${onlyDigits.slice(8, 12)}-${onlyDigits.slice(12)}`;
}

export default function PainelPGFNProspecao() {
  const [filters, setFilters] = useState<ProspeccaoFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<ProspeccaoRow[]>(MOCK_ROWS);
  const [kpis, setKpis] = useState({
    total: 4286,
    soma: 9_823_442_120,
    media: 458_732,
    pctAju: 0.37,
    recentes: 612,
  });

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

  const handleApplyFilters = async () => {
    setLoading(true);
    try {
      console.info('[PGFN][filters] apply', filters);
      // const qs = new URLSearchParams({
      //   q: filters.q,
      //   min: String(filters.valor[0]),
      //   max: String(filters.valor[1]),
      //   tempo: filters.tempo,
      //   aju: filters.aju,
      //   tipo: filters.tipo,
      //   uf: filters.uf,
      // }).toString();
      // const [kpisResponse, rowsResponse] = await Promise.all([
      //   fetch(`/api/pgfn/kpis?${qs}`).then((res) => res.json()),
      //   fetch(`/api/pgfn/search?${qs}`).then((res) => res.json()),
      // ]);
      // setKpis({
      //   total: Number(kpisResponse.total || 0),
      //   soma: Number(kpisResponse.soma || 0),
      //   media: Number(kpisResponse.media || 0),
      //   pctAju: Number(kpisResponse.pct_aju || 0) / 100,
      //   recentes: Number(kpisResponse.recentes || 0),
      // });
      // setRows(rowsResponse.rows || []);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setRows(MOCK_ROWS);
    setKpis({
      total: 4286,
      soma: 9_823_442_120,
      media: 458_732,
      pctAju: 0.37,
      recentes: 612,
    });
  };

  const creditTypeData = useMemo(
    () => [
      { name: 'FGTS', value: 42 },
      { name: 'Previdenciário', value: 33 },
      { name: 'Demais Débitos', value: 14 },
      { name: 'CIDA', value: 7 },
      { name: 'Outros', value: 4 },
    ],
    [],
  );

  const faixaValorData = useMemo(
    () => [
      { faixa: 'Até 250k', total: 1432 },
      { faixa: '250k – 750k', total: 982 },
      { faixa: '750k – 1.5M', total: 624 },
      { faixa: '1.5M – 3M', total: 441 },
      { faixa: 'Acima de 3M', total: 187 },
    ],
    [],
  );

  const topCnaeData = useMemo(
    () => [
      { cnae: '6201-5/01', total: 18 },
      { cnae: '4120-4/00', total: 14 },
      { cnae: '8610-1/01', total: 11 },
      { cnae: '4622-2/00', total: 9 },
      { cnae: '4711-3/02', total: 8 },
    ],
    [],
  );

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
            Refine a base por inscrição, valor consolidado, tempo de dívida, judicialização, tipo de crédito e UF.
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleApplyFilters} disabled={loading}>
              {loading ? 'Aplicando filtros...' : 'Aplicar filtros'}
            </Button>
            <Button type="button" variant="outline" onClick={handleResetFilters} disabled={loading}>
              Limpar
            </Button>
            <p className="text-xs text-muted-foreground">
              {rows.length.toLocaleString('pt-BR')} inscrições exibidas nesta amostra.
            </p>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={creditTypeData} innerRadius={60} outerRadius={100} paddingAngle={6}>
                  {creditTypeData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={32} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Faixa de valor consolidado</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faixaValorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
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
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top CNAEs (inscrições)</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCnaeData} layout="vertical" margin={{ top: 16, left: 12, right: 16, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="cnae"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  width={90}
                />
                <RechartsTooltip
                  formatter={(value: number) => [`${value.toLocaleString('pt-BR')} inscrições`, 'Total']}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="total" radius={[8, 8, 8, 8]} fill="hsl(var(--secondary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border-border bg-card shadow-soft">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold">Inscrições selecionadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualize dados cadastrais, valores consolidados, CNAE e situação de judicialização das inscrições filtradas.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                {['CNPJ', 'Nome', 'Valor', 'Tipo', 'Data', 'Ajuizado', 'CNAE', 'UF', 'Ações'].map((header) => (
                  <th key={header} className="bg-muted/40 px-3 py-2 text-left font-semibold first:rounded-l-xl last:rounded-r-xl">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.cnpj}-${row.data}`} className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{formatCnpj(row.cnpj)}</td>
                  <td className="px-3 py-3 font-medium text-foreground">{row.nome}</td>
                  <td className="px-3 py-3 font-semibold text-primary">{formatCurrency(row.valor)}</td>
                  <td className="px-3 py-3 text-foreground">{row.tipo}</td>
                  <td className="px-3 py-3 text-foreground">{new Date(row.data).toLocaleDateString('pt-BR')}</td>
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
                  <td className="px-3 py-3 text-foreground">{row.cnae}</td>
                  <td className="px-3 py-3 text-foreground">{row.uf}</td>
                  <td className="px-3 py-3">
                    <Button variant="outline" size="sm">
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
