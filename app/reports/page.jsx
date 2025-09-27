'use client';
import { useEffect, useMemo, useState } from 'react';
import Filters from '../../components/Filters';
import ReportTable from '../../components/ReportTable';
import ExportButton from '../../components/ExportButton';
import SummaryCard from '@/components/SummaryCard';

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({});
  const [maxLeads, setMaxLeads] = useState(30);

  const fetchData = (filt, limit = maxLeads) => {
    const params = new URLSearchParams();
    Object.entries(filt).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    if (limit) params.append('maxLeads', limit);

    fetch(`/api/reports?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.rows);
      });
  };

  const handleFilter = (f) => {
    // ✅ Se o filtro de porte vier como array (do <select multiple>), converte para string
    const adjusted = { ...f };
    if (Array.isArray(adjusted.porte)) {
      adjusted.porte = adjusted.porte.join(',');
    }

    setFilters(adjusted);
    fetchData(adjusted);
  };

  const handleMaxLeadsChange = (value) => {
    const num = parseInt(value, 10);
    const val = Number.isNaN(num) ? 30 : num;
    setMaxLeads(val);
    fetchData(filters, val);
  };

  useEffect(() => {
    fetchData({}, maxLeads);
  }, []);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const formatNumber = (value) => numberFormatter.format(value);

  const summary = useMemo(() => {
    const totalLeads = rows.length;
    const uniqueCompanies = new Set(
      rows.map((row) => (row.company || '').trim()).filter((company) => company.length > 0),
    ).size;
    const uniqueContacts = new Set(
      rows.map((row) => (row.nome || '').trim().toLowerCase()).filter((contact) => contact.length > 0),
    ).size;
    const reachable = rows.filter(
      (row) => (Array.isArray(row.normalizedPhones) && row.normalizedPhones.length > 0) || !!row.email,
    ).length;

    return {
      totalLeads,
      uniqueCompanies,
      uniqueContacts,
      reachable,
    };
  }, [rows]);

  const filtersSummary = useMemo(() => {
    const criteria = Object.entries(filters)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    return [criteria, `maxLeads: ${maxLeads || 30}`].filter(Boolean).join(' | ');
  }, [filters, maxLeads]);

  const generatedAt = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );

  const exportFilters = useMemo(() => ({ ...filters, maxLeads }), [filters, maxLeads]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Relatórios</p>
          <h1 className="text-3xl font-semibold text-foreground">Lista de Prospecção</h1>
          <p className="text-sm text-muted-foreground">
            Dados consolidados em {generatedAt}. {filtersSummary ? `Filtros: ${filtersSummary}.` : 'Todos os filtros estão limpos.'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ExportButton data={rows} filters={exportFilters} />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total de leads"
          value={formatNumber(summary.totalLeads)}
          helper="Registros retornados com os filtros atuais"
        />
        <SummaryCard
          title="Empresas únicas"
          value={formatNumber(summary.uniqueCompanies)}
          helper="Organizações distintas encontradas"
        />
        <SummaryCard
          title="Contatos únicos"
          value={formatNumber(summary.uniqueContacts)}
          helper="Profissionais diferentes com dados disponíveis"
        />
        <SummaryCard
          title="Leads alcançáveis"
          value={formatNumber(summary.reachable)}
          helper="Possuem telefone ou e-mail para contato"
        />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configurações e filtros</h2>
            <p className="text-sm text-muted-foreground">
              Ajuste os parâmetros de segmento, porte e limite de leads para personalizar o relatório exportado.
            </p>
          </div>
          <Filters onFilter={handleFilter} />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="maxLeads" className="text-sm font-medium text-muted-foreground">
              Máximo de leads por impressão
            </label>
            <input
              id="maxLeads"
              type="number"
              list="maxLeadsOptions"
              value={maxLeads}
              onChange={(e) => handleMaxLeadsChange(e.target.value)}
              className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <datalist id="maxLeadsOptions">
              <option value="10" />
              <option value="30" />
              <option value="50" />
              <option value="100" />
            </datalist>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Resultado da prospecção</h2>
            <p className="text-sm text-muted-foreground">
              Visualize os leads com os filtros aplicados e exporte quando necessário.
            </p>
          </div>
          <ReportTable rows={rows} />
        </div>
      </section>
    </div>
  );
}

