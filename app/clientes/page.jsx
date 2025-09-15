'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';
import NewCompanyModal from '../../components/NewCompanyModal';
import EnrichmentPreviewDialog from '../../components/EnrichmentPreviewDialog';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';
import fetchJson from '@/lib/http/fetchJson';

async function openConfirmDialog({ title, description, confirmText, cancelText }) {
  const msg = `${title}\n\n${description}\n\n[OK] ${confirmText}\n[Cancelar] ${cancelText}`;
  return window.confirm(msg) ? 'confirm' : 'cancel';
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');

  // State for modals
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyPrefill, setCompanyPrefill] = useState(null);
  const [enrichPreview, setEnrichPreview] = useState(null);
  const [showEnrichPreview, setShowEnrichPreview] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const fetchClients = async () => {
    try {
      const data = await fetchJson('/api/clientes');
      setClients(data.clients);
      setFiltered(data.clients);
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        router.push('/login?callbackUrl=/clientes');
      }
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFilter = ({ query, segmento, porte, uf, cidade } = {}) => {
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
        const json = await fetchJson('/api/empresas/enriquecer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: query })
        });
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Cadastrar Novo
            </button>
            <button
              onClick={handleEnrichQuery}
              disabled={isEnriching}
              className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400 flex items-center"
            >
              {isEnriching && <FaSpinner className="animate-spin mr-2" />}
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

