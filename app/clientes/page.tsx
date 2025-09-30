'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import ClientCard from '@/components/client-card';
import Filters, { type ActiveFilters, type FilterKey, type FilterOptions } from '@/components/Filters';
import NewCompanyModal from '@/components/NewCompanyModal';
import EnrichmentPreviewDialog from '@/components/EnrichmentPreviewDialog';
import SummaryCard from '@/components/SummaryCard';
import { useFilterState } from '@/hooks/useFilterState';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';

interface ClientRecord {
  id: string;
  company: string;
  segment?: string;
  size?: string;
  uf?: string;
  city?: string;
  contacts?: any[];
  opportunities?: string[];
  color?: string;
  [key: string]: unknown;
}

interface ClientsResponse {
  clients: ClientRecord[];
  filters: Record<string, string[]>;
}

type EnrichPreview = {
  error?: string;
  base?: { Nome_da_Empresa?: string };
  data?: unknown;
};

const filterDefaults: ActiveFilters = {
  segmento: [],
  porte: [],
  uf: [],
  cidade: [],
  erp: [],
  fase: [],
  origem: [],
  vendedor: []
};

async function openConfirmDialog({
  title,
  description,
  confirmText,
  cancelText
}: {
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
}) {
  const message = `${title}\n\n${description}\n\n[OK] ${confirmText}\n[Cancelar] ${cancelText}`;
  return window.confirm(message) ? 'confirm' : 'cancel';
}

function useSearchQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    const currentString = searchParams.toString();
    const params = new URLSearchParams(currentString);
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    const paramsString = params.toString();
    const next = `${pathname}${paramsString ? `?${paramsString}` : ''}`;
    const current = `${pathname}${currentString ? `?${currentString}` : ''}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [hydrated, pathname, query, router, searchParams]);

  return { query, setQuery };
}

function ClientesPageComponent() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState<any>(null);
  const [enrichPreview, setEnrichPreview] = useState<EnrichPreview | null>(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const { state: filters, update, reset } = useFilterState(filterDefaults);
  const { query, setQuery } = useSearchQuery();

  useEffect(() => {
    async function loadClients() {
      const response = await fetch('/api/clientes');
      const json: ClientsResponse = await response.json();
      setClients(json.clients);
      setOptions(json.filters || {});
    }
    loadClients();
  }, []);

  const filterOptionsForMultiSelect = useMemo<FilterOptions>(() => {
    const mapToOptions = (values?: string[]) => (values || []).map((value) => ({ label: value, value }));
    return {
      segmento: mapToOptions(options.segmento),
      porte: mapToOptions(options.porte),
      uf: mapToOptions(options.uf),
      cidade: mapToOptions(options.cidade),
      erp: mapToOptions(options.erp),
      fase: mapToOptions(options.fase),
      origem: mapToOptions(options.origem),
      vendedor: mapToOptions(options.vendedor)
    };
  }, [options]);

  const handleFilterChange = (next: ActiveFilters) => {
    (Object.keys(next) as FilterKey[]).forEach((key) => {
      const incoming = next[key] ?? [];
      const current = filters[key] ?? [];
      if (incoming.length !== current.length || incoming.some((value, index) => value !== current[index])) {
        update(key, incoming);
      }
    });
  };

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSegment = !filters.segmento.length || filters.segmento.includes((client.segment || '').trim());
      if (!matchesSegment) return false;
      const matchesSize = !filters.porte.length || filters.porte.includes((client.size || '').trim());
      if (!matchesSize) return false;
      const matchesUf = !filters.uf.length || filters.uf.includes((client.uf || '').trim());
      if (!matchesUf) return false;
      const matchesCity = !filters.cidade.length || filters.cidade.includes((client.city || '').trim());
      if (!matchesCity) return false;
      const matchesErp = !filters.erp.length || filters.erp.includes((client.erp as string || '').trim());
      if (!matchesErp) return false;
      const matchesStage = !filters.fase.length || filters.fase.includes((client.status as string || '').trim());
      if (!matchesStage) return false;
      const matchesOrigin = !filters.origem.length || filters.origem.includes((client.fonte as string || '').trim());
      if (!matchesOrigin) return false;
      const matchesOwner = !filters.vendedor.length || filters.vendedor.includes((client.owner as string || '').trim());
      if (!matchesOwner) return false;

      if (!normalizedQuery) {
        return true;
      }

      const baseName = (client.company || '').toLowerCase();
      const contactMatch = Array.isArray(client.contacts)
        ? client.contacts.some((contact: any) =>
            [contact?.name, contact?.nome, contact?.email]
              .filter(Boolean)
              .some((value: string) => value.toLowerCase().includes(normalizedQuery))
          )
        : false;
      const opportunityMatch = Array.isArray(client.opportunities)
        ? client.opportunities.some((opportunity) => (opportunity || '').toLowerCase().includes(normalizedQuery))
        : false;

      return (
        baseName.includes(normalizedQuery) ||
        contactMatch ||
        opportunityMatch
      );
    });
  }, [clients, filters, query]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);

  const summary = useMemo(() => {
    const contacts = filteredClients.reduce((total, client) => {
      const value = Array.isArray(client.contacts) ? client.contacts.length : 0;
      return total + value;
    }, 0);

    const segments = new Set(filteredClients.map((client) => (client.segment || '').trim()).filter(Boolean));
    const states = new Set(filteredClients.map((client) => (client.uf || '').trim()).filter(Boolean));

    return {
      visible: filteredClients.length,
      total: clients.length,
      contacts,
      segments: segments.size,
      states: states.size
    };
  }, [clients.length, filteredClients]);

  const hasActiveQuery = query.trim().length > 0;
  const showEmptyState = filteredClients.length === 0 && hasActiveQuery;

  const formatNumber = (value: number) => numberFormatter.format(value);

  const previewPayload = enrichPreview?.data as any;
  const suggestionFlat = previewPayload?.suggestion ?? previewPayload ?? null;
  const rawJsonPreview = previewPayload?.debug?.parsedJson ?? previewPayload?.rawJson ?? previewPayload ?? null;

  async function handleEnrichQuery() {
    if (!hasActiveQuery) return;
    setIsEnriching(true);
    try {
      const response = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: query })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao enriquecer');
      }
      setEnrichPreview({ data: payload, base: { Nome_da_Empresa: query } });
      setShowEnrichPreview(true);
    } catch (error: any) {
      console.error(error);
      setEnrichPreview({
        error: error?.toString?.() || 'Erro ao enriquecer',
        base: { Nome_da_Empresa: query }
      });
      setShowEnrichPreview(true);
    } finally {
      setIsEnriching(false);
    }
  }

  function handleOpenNewCompanyModal(initialData = {}) {
    setCompanyPrefill(initialData);
    setCompanyModalOpen(true);
  }

  function handleSaveNewCompany() {
    setCompanyModalOpen(false);
    setCompanyPrefill(null);
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((json: ClientsResponse) => {
        setClients(json.clients);
        setOptions(json.filters || {});
      });
  }

  function handleReset() {
    reset();
    setQuery('');
  }

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
            {isEnriching ? <FaSpinner className="h-4 w-4 animate-spin" /> : null}
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
          <Filters
            filters={filters}
            searchQuery={query}
            options={filterOptionsForMultiSelect}
            onFilterChange={handleFilterChange}
            onSearchChange={setQuery}
            onReset={handleReset}
          />
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        suggestionFlat={suggestionFlat}
        baseCompany={(enrichPreview?.base as any) ?? null}
        rawJson={rawJsonPreview}
        error={enrichPreview?.error}
        onConfirm={async (flat) => {
          const merged = { ...(enrichPreview?.base ?? {}), ...flat };
          const cnpjFinal = await decideCNPJFinal({
            currentFormCNPJ: (enrichPreview?.base as any)?.CNPJ_Empresa,
            enrichedCNPJ: (flat as any)?.CNPJ_Empresa ?? (flat as any)?.cnpj,
            ask: async (matriz, filial) => {
              const choice = await openConfirmDialog({
                title: 'CNPJ indica Filial',
                description: `Detectamos FILIAL (${filial}). Deseja salvar como filial mesmo?\nSe preferir Matriz, salvaremos ${matriz}.`,
                confirmText: 'Usar Matriz',
                cancelText: 'Manter Filial'
              });
              return choice === 'confirm';
            }
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
