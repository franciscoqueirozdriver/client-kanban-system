'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';

import ClientCard from '@/components/ClientCard';
import Filters from '@/components/Filters';
import EnrichmentPreviewDialog from '@/components/EnrichmentPreviewDialog';
import NewCompanyModal from '@/components/NewCompanyModal';
import SummaryCard from '@/components/SummaryCard';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';
import { useFilterState } from '@/hooks/useFilterState';

interface Client {
  id: string;
  company: string;
  segment?: string;
  size?: string;
  uf?: string;
  city?: string;
  contacts?: any[];
  opportunities?: string[];
  [key: string]: any;
}

interface FilterOptions {
  segmento: string[];
  porte: string[];
  uf: string[];
  cidade: string[];
}

interface EnrichPreviewState {
  suggestion?: any;
  debug?: any;
  error?: string;
  base?: any;
}

async function openConfirmDialog({
  title,
  description,
  confirmText,
  cancelText,
}: {
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
}) {
  const msg = `${title}\n\n${description}\n\n[OK] ${confirmText}\n[Cancelar] ${cancelText}`;
  return window.confirm(msg) ? 'confirm' : 'cancel';
}

function ClientesPageComponent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allOptions, setAllOptions] = useState<FilterOptions>({ segmento: [], porte: [], uf: [], cidade: [] });

  const { state: filters, update: handleFilterUpdate, reset } = useFilterState({
    query: [],
    segmento: [],
    porte: [],
    uf: [],
    cidade: [],
  });

  const query = useMemo(() => filters.query?.[0] || '', [filters.query]);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState<any>(null);
  const [enrichPreview, setEnrichPreview] = useState<EnrichPreviewState | null>(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const fetchClients = () => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients);
        setAllOptions(data.filters);
      });
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (filters.segmento.length > 0 && !filters.segmento.includes((client.segment || '').trim())) return false;
      if (filters.porte.length > 0 && !filters.porte.includes((client.size || '').trim())) return false;
      if (filters.uf.length > 0 && !filters.uf.includes((client.uf || '').trim())) return false;
      if (filters.cidade.length > 0 && !filters.cidade.includes((client.city || '').trim())) return false;

      if (query) {
        const q = query.toLowerCase();
        const matchName = (client.company || '').toLowerCase().includes(q);
        const matchContact = (client.contacts || []).some((c: any) => (c.name || c.nome || '').toLowerCase().includes(q));
        const matchOpp = (client.opportunities || []).some((o: string) => (o || '').toLowerCase().includes(q));
        if (!matchName && !matchContact && !matchOpp) return false;
      }
      return true;
    });
  }, [clients, filters, query]);

  const filterOptionsForMultiSelect = useMemo(() => {
    return {
      segmento: allOptions.segmento.map((s) => ({ label: s, value: s })),
      porte: allOptions.porte.map((p) => ({ label: p, value: p })),
      uf: allOptions.uf.map((u) => ({ label: u, value: u })),
      cidade: allOptions.cidade.map((c) => ({ label: c, value: c })),
    };
  }, [allOptions]);

  const handleFilterChange = (key: string, value: string | string[]) => {
    if (key === 'query') {
      handleFilterUpdate('query', [value as string]);
    } else {
      handleFilterUpdate(key, value as string[]);
    }
  };

  const handleEnrichQuery = async () => {
    if (!query) return;
    setIsEnriching(true);
    try {
      const resp = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: query }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Falha ao enriquecer');
      setEnrichPreview({ ...json, base: { Nome_da_Empresa: query } });
      setShowEnrichPreview(true);
    } catch (error: any) {
      console.error(error);
      setEnrichPreview({ error: error?.toString?.() || 'Erro ao enriquecer', base: { Nome_da_Empresa: query } });
      setShowEnrichPreview(true);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleOpenNewCompanyModal = (initialData = {}) => {
    setCompanyPrefill(initialData);
    setCompanyModalOpen(true);
  };

  const handleSaveNewCompany = () => {
    setCompanyModalOpen(false);
    setCompanyPrefill(null);
    fetchClients();
  };

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);

  const summary = useMemo(() => {
    const base = filteredClients;
    const contacts = base.reduce(
      (total, client) => total + (Array.isArray(client?.contacts) ? client.contacts.length : 0),
      0,
    );
    const segments = new Set(base.map((client) => (client?.segment || '').trim()).filter(Boolean));
    const states = new Set(base.map((client) => (client?.uf || '').trim()).filter(Boolean));

    return {
      visible: base.length,
      total: clients.length,
      contacts,
      segments: segments.size,
      states: states.size,
    };
  }, [filteredClients, clients.length]);

  const formatNumber = (value: number) => numberFormatter.format(value);
  const hasActiveQuery = query.trim().length > 0;
  const showEmptyState = filteredClients.length === 0 && hasActiveQuery;

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Gestão</p>
          <h1 className="text-3xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Liste, filtre e gerencie clientes e contatos.</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => handleOpenNewCompanyModal()}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Novo cliente
          </button>
          <button
            type="button"
            onClick={handleEnrichQuery}
            disabled={!hasActiveQuery || isEnriching}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEnriching && <FaSpinner className="h-4 w-4 animate-spin" />}
            Enriquecer busca
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Clientes exibidos"
          value={formatNumber(summary.visible)}
          helper={`Filtrados a partir de ${formatNumber(summary.total)} cadastros`}
        />
        <SummaryCard
          title="Contatos vinculados"
          value={formatNumber(summary.contacts)}
          helper="Soma de contatos associados aos clientes listados"
        />
        <SummaryCard
          title="Segmentos ativos"
          value={formatNumber(summary.segments)}
          helper="Segmentos únicos encontrados na seleção"
        />
        <SummaryCard
          title="Estados presentes"
          value={formatNumber(summary.states)}
          helper="Distribuição geográfica dos clientes filtrados"
        />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtros e pesquisa</h2>
            <p className="text-sm text-muted-foreground">
              Utilize os filtros abaixo para refinar a visualização de clientes por segmento, porte ou localização.
            </p>
          </div>
          <Filters filters={{ ...filters, query }} options={filterOptionsForMultiSelect} onFilterChange={handleFilterChange} onReset={reset} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Clientes cadastrados</h2>
              <p className="text-sm text-muted-foreground">
                {formatNumber(filteredClients.length)} de {formatNumber(clients.length)} registros exibidos.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1 text-sm font-medium text-muted-foreground shadow-soft">
              Exibindo
              <span className="tabular-nums text-foreground">{formatNumber(filteredClients.length)}</span>
            </span>
          </div>

          {showEmptyState ? (
            <div className="space-y-6 rounded-2xl border border-dashed border-border/70 bg-muted/40 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum cliente encontrado para <span className="font-semibold text-foreground">“{query}”</span>.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </div>
      </section>

      <NewCompanyModal
        isOpen={companyModalOpen}
        initialData={companyPrefill || undefined}
        onClose={() => {
          setCompanyModalOpen(false);
          setCompanyPrefill(null);
        }}
        onSaved={handleSaveNewCompany}
      />

      <EnrichmentPreviewDialog
        isOpen={showEnrichPreview}
        onClose={() => setShowEnrichPreview(false)}
        suggestionFlat={enrichPreview?.suggestion || null}
        rawJson={enrichPreview?.debug?.parsedJson}
        error={enrichPreview?.error ? String(enrichPreview.error) : undefined}
        onConfirm={async (flat) => {
          const merged = { ...enrichPreview?.base, ...flat };
          const cnpjFinal = await decideCNPJFinal({
            currentFormCNPJ: merged?.CNPJ_Empresa,
            enrichedCNPJ: flat?.CNPJ_Empresa ?? flat?.cnpj,
            ask: async (matriz, filial) => {
              const choice = await openConfirmDialog({
                title: 'CNPJ indica Filial',
                description: `Detectamos FILIAL (${filial}). Deseja salvar como filial mesmo?\nSe preferir Matriz, salvaremos ${matriz}.`,
                confirmText: 'Usar Matriz',
                cancelText: 'Manter Filial',
              });
              return choice === 'confirm';
            },
          });
          const mergedWithCnpj = { ...merged, CNPJ_Empresa: cnpjFinal };
          handleOpenNewCompanyModal(mergedWithCnpj);
          setShowEnrichPreview(false);
        }}
      />
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div>Carregando filtros...</div>}>
      <ClientesPageComponent />
    </Suspense>
  );
}
