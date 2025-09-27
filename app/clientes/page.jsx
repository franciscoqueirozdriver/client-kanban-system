'use client';
import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';
import NewCompanyModal from '../../components/NewCompanyModal';
import EnrichmentPreviewDialog from '../../components/EnrichmentPreviewDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';

export default function ClientesPage() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');

  // State for modals
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState(null);
  const [enrichPreview, setEnrichPreview] = useState(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [cnpjConfirm, setCnpjConfirm] = useState({ isOpen: false });

  const fetchClients = () => {
    fetch('/api/clientes')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients);
        setFiltered(data.clients);
      });
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFilter = ({ query, segmento, porte, uf, cidade }) => {
    setQuery(query); // Keep track of the query for the "no results" case
    let result = clients.filter((client) => {
      if (segmento && segmento.trim() && (client.segment || '').trim().toLowerCase() !== segmento.trim().toLowerCase()) return false;
      if (porte && porte.length > 0 && !porte.map(p => p.toLowerCase()).includes((client.size || '').trim().toLowerCase())) return false;
      if (uf && uf.trim() && (client.uf || '').trim().toLowerCase() !== uf.trim().toLowerCase()) return false;
      if (cidade && cidade.trim() && (client.city || '').trim().toLowerCase() !== cidade.trim().toLowerCase()) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchName = (client.company || '').toLowerCase().includes(q);
        const matchContact = (client.contacts || []).some((c) => (c.name || c.nome || '').toLowerCase().includes(q));
        const matchOpp = (client.opportunities || []).some((o) => (o || '').toLowerCase().includes(q));
        if (!matchName && !matchContact && !matchOpp) return false;
      }
      return true;
    });
    setFiltered(result);
  };

  const handleEnrichQuery = async () => {
    if (!query) return;
    setIsEnriching(true);
    try {
      const resp = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: query })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Falha ao enriquecer');
      setEnrichPreview({ ...json, base: { Nome_da_Empresa: query } });
      setShowEnrichPreview(true);
    } catch (e) {
      console.error(e);
      setEnrichPreview({ error: e?.toString?.() || 'Erro ao enriquecer', base: { Nome_da_Empresa: query } });
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
    // Refetch clients to show the new one
    fetchClients();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex">
        <div
          className="ml-auto text-2xl md:text-3xl font-semibold tracking-tight"
          aria-label="Total de clientes exibidos"
          data-testid="total-clientes-exibidos"
          title="Quantidade de clientes atualmente exibidos, após a aplicação de filtros"
        >
          TOTAL DE CLIENTES EXIBIDOS: <span className="tabular-nums">{filtered.length}</span>
        </div>
      </div>
      <Filters onFilter={handleFilter} />

      {filtered.length === 0 && query && (
        <div className="text-center py-10">
          <p className="mb-4">Nenhum cliente encontrado para "<strong>{query}</strong>".</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleOpenNewCompanyModal()}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cadastrar Novo
            </button>
            <button
              onClick={handleEnrichQuery}
              disabled={isEnriching}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              {isEnriching && <FaSpinner className="mr-2 h-4 w-4 animate-spin" />}
              Enriquecer
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>

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
          const merged = { ...enrichPreview.base, ...flat };
          const cnpjFinal = await decideCNPJFinal({
            currentFormCNPJ: merged?.CNPJ_Empresa,
            enrichedCNPJ: flat?.CNPJ_Empresa ?? flat?.cnpj,
            ask: (matriz, filial) => {
              return new Promise((resolve) => {
                setCnpjConfirm({
                  isOpen: true,
                  title: 'CNPJ indica Filial',
                  description: `Detectamos FILIAL (${filial}). Deseja salvar como filial mesmo? Se preferir Matriz, salvaremos ${matriz}.`,
                  confirmText: 'Usar Matriz',
                  cancelText: 'Manter Filial',
                  onConfirm: () => {
                    setCnpjConfirm({ isOpen: false });
                    resolve(true); // Use Matriz
                  },
                  onClose: () => {
                    setCnpjConfirm({ isOpen: false });
                    resolve(false); // Use Filial
                  },
                });
              });
            },
          });
          const mergedWithCnpj = { ...merged, CNPJ_Empresa: cnpjFinal };
          handleOpenNewCompanyModal(mergedWithCnpj);
          setShowEnrichPreview(false);
        }}
      />

      <ConfirmDialog
        isOpen={cnpjConfirm.isOpen}
        onClose={cnpjConfirm.onClose}
        onConfirm={cnpjConfirm.onConfirm}
        title={cnpjConfirm.title}
        description={cnpjConfirm.description}
        confirmText={cnpjConfirm.confirmText}
        cancelText={cnpjConfirm.cancelText}
      />
    </div>
  );
}

