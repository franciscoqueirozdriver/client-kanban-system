'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaSpinner } from 'react-icons/fa';
import ClientCard from '../../components/ClientCard';
import Filters from '../../components/Filters';
import NewCompanyModal from '../../components/NewCompanyModal';
import EnrichmentPreviewDialog from '../../components/EnrichmentPreviewDialog';

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
    setCompanyPrefill({ Nome_da_Empresa: query, ...initialData });
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
      <div className="flex justify-end">
        <Link href="/kanban" className="text-blue-600 underline">
          Ver Kanban
        </Link>
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
        onConfirm={(flat) => {
          const merged = { ...enrichPreview.base, ...flat };
          handleOpenNewCompanyModal(merged);
          setShowEnrichPreview(false);
        }}
      />
    </div>
  );
}

