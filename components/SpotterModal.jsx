'use client';
import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';

export default function SpotterModal({ isOpen, onClose, initialData }) {
  const [formData, setFormData] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Quando o modal abre, popula o formulário com os dados iniciais do card.
      const payload = {
        titulo: initialData?.company || 'Oportunidade no Kanban',
        empresa: initialData?.company || 'N/A',
        contato_nome: initialData?.contacts?.[0]?.name || null,
        contato_email: initialData?.contacts?.[0]?.email?.split(';')[0].trim() || null,
        contato_telefone: initialData?.contacts?.[0]?.normalizedPhones?.[0] || null,
        origem: 'Kanban',
        valor_previsto: typeof initialData?.valor === 'number' ? initialData.valor : null,
        observacoes: initialData?.observacoes || null
      };
      setFormData(payload);
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEnrich = async () => {
    if (!formData.empresa) {
      alert('Por favor, preencha o nome da empresa para enriquecer.');
      return;
    }
    setIsEnriching(true);
    setError(null);
    try {
      const res = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.empresa })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enriquecer');

      const suggestion = data.suggestion;
      setFormData(prev => ({
        ...prev,
        empresa: suggestion.Nome_da_Empresa || prev.empresa,
        contato_nome: suggestion.Nome_Contato || prev.contato_nome,
        contato_email: suggestion.Email_Contato || prev.contato_email,
        contato_telefone: suggestion.Telefones_Contato || prev.contato_telefone,
        observacoes: suggestion.Observacao_Empresa || prev.observacoes,
      }));
      alert('Dados enriquecidos com sucesso!');
    } catch (err) {
      setError(err.message);
      alert(`Erro ao enriquecer: ${err.message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/spoter/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);

      alert(`Sucesso! Resposta da API: ${JSON.stringify(data, null, 2)}`);
      onClose(); // Fecha o modal após o sucesso
    } catch (err) {
      setError(err.message);
      alert(`Erro ao enviar para o Spotter: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <header className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Enviar para Exact Spotter
          </h2>
          <p className="text-sm text-gray-500">Confirme ou edite os dados antes de enviar.</p>
        </header>

        <form onSubmit={handleSubmit} className="flex-grow contents">
          <div className="flex-grow p-6 space-y-4 overflow-y-auto">
            {/* Campos do Formulário */}
            <div>
              <label htmlFor="titulo" className="block text-sm font-medium mb-1">Título *</label>
              <input id="titulo" type="text" name="titulo" value={formData.titulo || ''} onChange={handleChange} required className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="empresa" className="block text-sm font-medium mb-1">Empresa *</label>
              <input id="empresa" type="text" name="empresa" value={formData.empresa || ''} onChange={handleChange} required className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="contato_nome" className="block text-sm font-medium mb-1">Nome do Contato</label>
              <input id="contato_nome" type="text" name="contato_nome" value={formData.contato_nome || ''} onChange={handleChange} className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="contato_email" className="block text-sm font-medium mb-1">Email do Contato</label>
              <input id="contato_email" type="email" name="contato_email" value={formData.contato_email || ''} onChange={handleChange} className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="contato_telefone" className="block text-sm font-medium mb-1">Telefone do Contato</label>
              <input id="contato_telefone" type="text" name="contato_telefone" value={formData.contato_telefone || ''} onChange={handleChange} className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="valor_previsto" className="block text-sm font-medium mb-1">Valor Previsto</label>
              <input id="valor_previsto" type="number" name="valor_previsto" value={formData.valor_previsto || ''} onChange={handleChange} className="w-full rounded border p-2"/>
            </div>
            <div>
              <label htmlFor="observacoes" className="block text-sm font-medium mb-1">Observações</label>
              <textarea id="observacoes" name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows={3} className="w-full rounded border p-2"/>
            </div>
          </div>

          <footer className="flex-shrink-0 px-6 py-4 border-t bg-white flex justify-between items-center">
            <button
              type="button"
              onClick={handleEnrich}
              disabled={isEnriching || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {isEnriching && <FaSpinner className="animate-spin" />}
              Enriquecer com IA
            </button>
            <div className="flex gap-3">
              {error && <p className="text-red-500 text-sm self-center mr-auto">{error}</p>}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSending || isEnriching}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isSending && <FaSpinner className="animate-spin" />}
                Enviar ao Spotter
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
