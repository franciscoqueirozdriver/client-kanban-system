'use client';

import { useState, useEffect, FormEvent } from 'react';
import { FaSpinner, FaSearch } from 'react-icons/fa';
import type { CompanySuggestion } from '../lib/perplexity';
import { toDigits, normalizeCNPJ, isValidCNPJ } from '@/src/utils/cnpj';
import { isEmptyCNPJLike } from '@/utils/cnpj-matriz';
import { decideCNPJFinal } from '@/helpers/decideCNPJ';
import { CnpjField } from './inputs/CnpjField';

// --- Types ---
interface CompanyData {
  nome_da_empresa?: string; site_empresa?: string; pais_empresa?: string; estado_empresa?: string;
  cidade_empresa?: string; logradouro_empresa?: string; numero_empresa?: string; bairro_empresa?: string;
  complemento_empresa?: string; cep_empresa?: string; cnpj_empresa?: string; ddi_empresa?: string;
  telefones_empresa?: string; observacao_empresa?: string;
}
interface ContactData {
  nome_contato?: string; email_contato?: string; cargo_contato?: string;
  ddi_contato?: string; telefones_contato?: string;
}
interface CommercialData {
  origem?: string; sub_origem?: string; mercado?: string; produto?: string; area?: string;
  etapa?: string; funil?: string; tipo_do_serv_comunicacao?: string; id_do_serv_comunicacao?: string;
}
export interface FullCompanyPayload {
  cliente_id?: string;
  empresa: CompanyData;
  contato: ContactData;
  comercial: CommercialData;
}
interface SavedCompany {
  cliente_id: string; nome_da_empresa: string; cnpj_empresa: string;
}
export interface NewCompanyModalProps {
  isOpen: boolean;
  initialData?: Partial<CompanyForm>;
  warning?: boolean;
  enrichDebug?: any;
  onClose: () => void;
  onSaved: (company: SavedCompany) => void;
}

type CompanyForm = CompanySuggestion & {
  cliente_id?: string;
  site_empresa?: string;
  pais_empresa?: string;
  estado_empresa?: string;
  cidade_empresa?: string;
  logradouro_empresa?: string;
  numero_empresa?: string;
  bairro_empresa?: string;
  complemento_empresa?: string;
  cep_empresa?: string;
  cnpj_empresa?: string;
  ddi_empresa?: string;
  telefones_empresa?: string;
  observacao_empresa?: string;
  nome_contato?: string;
  email_contato?: string;
  cargo_contato?: string;
  ddi_contato?: string;
  telefones_contato?: string;
  origem?: string;
  sub_origem?: string;
  mercado?: string;
  produto?: string;
  area?: string;
  etapa?: string;
  funil?: string;
  tipo_do_serv_comunicacao?: string;
  id_do_serv_comunicacao?: string;
};

// --- Normalization Utilities ---

function normalizeUF(uf?: string) {
  const u = (uf || '').trim().toUpperCase();
  return u.length === 2 ? u : '';
}

function normalizePhones(s?: string) {
  const raw = (s || '')
    .replace(/['"]/g, '')
    .split(/[;,/]| ou /i)
    .map(t => t.trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(raw)).map(t => {
    const d = toDigits(t);
    if (!d) return '';
    return d.startsWith('55') ? `+${d}` : `+55${d}`;
  }).filter(Boolean);
  return uniq.join('; ');
}

function applySuggestionToForm(current: CompanyForm, suggestion: Partial<CompanyForm>, onlyEmpty = true): CompanyForm {
  const s: Partial<CompanyForm> = { ...suggestion };

  if (s.cnpj_empresa) s.cnpj_empresa = normalizeCNPJ(s.cnpj_empresa);
  if (s.estado_empresa) s.estado_empresa = normalizeUF(s.estado_empresa);
  if (s.telefones_empresa) s.telefones_empresa = normalizePhones(s.telefones_empresa);
  if (s.telefones_contato) s.telefones_contato = normalizePhones(s.telefones_contato);
  if (s.ddi_empresa && !s.ddi_empresa.startsWith('+')) s.ddi_empresa = `+${toDigits(s.ddi_empresa) || '55'}`;
  if (s.ddi_contato && !s.ddi_contato.startsWith('+')) s.ddi_contato = `+${toDigits(s.ddi_contato) || '55'}`;
  if (s.pais_empresa === undefined) s.pais_empresa = 'Brasil';

  const next: CompanyForm = { ...current };

  (Object.keys(s) as (keyof CompanyForm)[]).forEach((key) => {
    const cur = (next[key] ?? '').toString().trim();
    const val = (s[key] ?? '').toString().trim();
    if ((onlyEmpty && !cur && val) || (!onlyEmpty && val)) next[key] = val as any;
  });

  return next;
}

// --- Initial State ---
const initialForm: CompanyForm = {
  nome_da_empresa: '',
  site_empresa: '',
  pais_empresa: 'Brasil',
  estado_empresa: '',
  cidade_empresa: '',
  logradouro_empresa: '',
  numero_empresa: '',
  bairro_empresa: '',
  complemento_empresa: '',
  cep_empresa: '',
  cnpj_empresa: '',
  ddi_empresa: '+55',
  telefones_empresa: '',
  observacao_empresa: '',
  nome_contato: '',
  email_contato: '',
  cargo_contato: '',
  ddi_contato: '+55',
  telefones_contato: '',
  mercado: '',
  produto: '',
  area: '',
  origem: 'Cadastro Manual',
  sub_origem: 'Modal PER/DCOMP',
  etapa: 'Novo',
  funil: 'Pré-venda',
  tipo_do_serv_comunicacao: '',
  id_do_serv_comunicacao: '',
};

// --- Component ---
export default function NewCompanyModal({ isOpen, initialData, warning, enrichDebug: initialDebug, onClose, onSaved }: NewCompanyModalProps) {
  const [formData, setFormData] = useState<CompanyForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [enrichDebug, setEnrichDebug] = useState<any>(null);

  const isUpdateMode = !!formData.cliente_id;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setEnrichDebug(initialDebug || null);
      setFormData(initialForm);
      if (initialData) {
        setFormData(prev => applySuggestionToForm(prev, initialData, false));
      }
    }
  }, [isOpen, initialData, initialDebug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    onClose();
    setFormData(initialForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.nome_da_empresa) {
      setError('O "Nome da Empresa" é obrigatório.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const decided = await decideCNPJFinal({
        currentFormCNPJ: formData.cnpj_empresa,
        enrichedCNPJ: initialData?.cnpj,
        ask: async () => false,
      });
      const cnpj = normalizeCNPJ(decided);
      if (cnpj && !isValidCNPJ(cnpj)) {
        setIsLoading(false);
        setError('CNPJ inválido. Verifique e tente novamente.');
        return;
      }
      const payload: FullCompanyPayload = {
        cliente_id: formData.cliente_id,
        empresa: {
          nome_da_empresa: formData.nome_da_empresa,
          site_empresa: formData.site_empresa,
          pais_empresa: formData.pais_empresa,
          estado_empresa: formData.estado_empresa,
          cidade_empresa: formData.cidade_empresa,
          logradouro_empresa: formData.logradouro_empresa,
          numero_empresa: formData.numero_empresa,
          bairro_empresa: formData.bairro_empresa,
          complemento_empresa: formData.complemento_empresa,
          cep_empresa: formData.cep_empresa,
          cnpj_empresa: cnpj,
          ddi_empresa: formData.ddi_empresa,
          telefones_empresa: formData.telefones_empresa,
          observacao_empresa: formData.observacao_empresa,
        },
        contato: {
          nome_contato: formData.nome_contato,
          email_contato: formData.email_contato,
          cargo_contato: formData.cargo_contato,
          ddi_contato: formData.ddi_contato,
          telefones_contato: formData.telefones_contato,
        },
        comercial: {
          origem: formData.origem,
          sub_origem: formData.sub_origem,
          mercado: formData.mercado,
          produto: formData.produto,
          area: formData.area,
          etapa: formData.etapa,
          funil: formData.funil,
          tipo_do_serv_comunicacao: formData.tipo_do_serv_comunicacao,
          id_do_serv_comunicacao: formData.id_do_serv_comunicacao,
        },
      };

      const res = await fetch('/api/empresas/cadastrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao salvar empresa.');
      }
      onSaved(data.company);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" role="dialog" aria-labelledby="modal-title">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <header className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isUpdateMode ? 'Atualizar Empresa' : 'Cadastrar Nova Empresa'}
            </h2>
            <p className="text-sm text-gray-500">Preencha os dados abaixo. Campos com * são obrigatórios.</p>
        </header>

        <form onSubmit={handleSubmit} className="flex-grow contents">
            <div className="flex-grow p-6 space-y-6 overflow-y-auto">
                {warning && (
                  <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 rounded p-2 text-sm">
                    Não foi possível enriquecer automaticamente. Você pode preencher manualmente.
                  </div>
                )}
                {process.env.NEXT_PUBLIC_SHOW_ENRICH_DEBUG === '1' && enrichDebug && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setDebugOpen(true)}
                      className="text-xs underline text-gray-600 hover:text-gray-900"
                    >
                      Ver resposta da API (debug)
                    </button>
                  </div>
                )}
                {/* --- Dados da Empresa --- */}
                <section>
                  <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    <div className="md:col-span-2">
                      <label htmlFor="nome-empresa" className="block text-sm font-medium mb-1">Nome da Empresa *</label>
                      <input id="nome-empresa" type="text" name="nome_da_empresa" value={formData.nome_da_empresa || ''} onChange={handleChange} required aria-required="true" className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="cnpj-empresa" className="block text-sm font-medium mb-1">CNPJ Empresa</label>
                      <div className="flex items-center gap-2">
                        <CnpjField
                          id="cnpj-empresa"
                          name="cnpj_empresa"
                          value={formData.cnpj_empresa || ''}
                          onChange={e => setFormData(prev => ({ ...prev, cnpj_empresa: e.target.value }))}
                          className="flex-grow w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"
                          formatVisual={true}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const query = encodeURIComponent(`${formData.nome_da_empresa} CNPJ`);
                            window.open(`https://www.google.com/search?q=${query}`, '_blank');
                          }}
                          className="p-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                          aria-label="Pesquisar CNPJ no Google"
                          title="Pesquisar CNPJ no Google"
                        >
                          <FaSearch />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">O CNPJ será formatado automaticamente.</p>
                    </div>
                    <div>
                      <label htmlFor="site-empresa" className="block text-sm font-medium mb-1">Site Empresa</label>
                      <input id="site-empresa" type="url" name="site_empresa" placeholder="https://..." value={formData.site_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="logradouro-empresa" className="block text-sm font-medium mb-1">Logradouro</label>
                            <input id="logradouro-empresa" type="text" name="logradouro_empresa" value={formData.logradouro_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                        <div>
                            <label htmlFor="numero-empresa" className="block text-sm font-medium mb-1">Número</label>
                            <input id="numero-empresa" type="text" name="numero_empresa" value={formData.numero_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                        <div>
                            <label htmlFor="bairro-empresa" className="block text-sm font-medium mb-1">Bairro</label>
                            <input id="bairro-empresa" type="text" name="bairro_empresa" value={formData.bairro_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                    </div>
                    <div>
                      <label htmlFor="cidade-empresa" className="block text-sm font-medium mb-1">Cidade</label>
                      <input id="cidade-empresa" type="text" name="cidade_empresa" value={formData.cidade_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="estado-empresa" className="block text-sm font-medium mb-1">Estado (UF)</label>
                      <input id="estado-empresa" type="text" name="estado_empresa" value={formData.estado_empresa || ''} onChange={e => setFormData(prev => ({ ...prev, estado_empresa: e.target.value.toUpperCase() }))} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Use a sigla, ex.: SP</p>
                    </div>
                    <div>
                      <label htmlFor="cep-empresa" className="block text-sm font-medium mb-1">CEP</label>
                      <input id="cep-empresa" type="text" name="cep_empresa" value={formData.cep_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Formato 00000-000</p>
                    </div>
                    <div>
                      <label htmlFor="pais-empresa" className="block text-sm font-medium mb-1">País</label>
                      <input id="pais-empresa" type="text" name="pais_empresa" value={formData.pais_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="ddi-empresa" className="block text-sm font-medium mb-1">DDI Empresa</label>
                      <input id="ddi-empresa" type="text" name="ddi_empresa" value={formData.ddi_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="telefones-empresa" className="block text-sm font-medium mb-1">Telefones Empresa</label>
                      <input id="telefones-empresa" type="text" name="telefones_empresa" value={formData.telefones_empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Separe múltiplos por ;</p>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="obs-empresa" className="block text-sm font-medium mb-1">Observação</label>
                      <textarea id="obs-empresa" name="observacao_empresa" value={formData.observacao_empresa || ''} onChange={handleChange} rows={3} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                  </div>
                </section>

                <section className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                  <h3 className="text-lg font-semibold pb-2 mb-4">Dados de Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nome-contato" className="block text-sm font-medium mb-1">Nome Contato</label>
                      <input id="nome-contato" type="text" name="nome_contato" value={formData.nome_contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="cargo-contato" className="block text-sm font-medium mb-1">Cargo Contato</label>
                      <input id="cargo-contato" type="text" name="cargo_contato" value={formData.cargo_contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="email-contato" className="block text-sm font-medium mb-1">E-mail Contato</label>
                      <input id="email-contato" type="email" name="email_contato" value={formData.email_contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="ddi-contato" className="block text-sm font-medium mb-1">DDI Contato</label>
                      <input id="ddi-contato" type="text" name="ddi_contato" value={formData.ddi_contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="telefones-contato" className="block text-sm font-medium mb-1">Telefones Contato</label>
                      <input id="telefones-contato" type="text" name="telefones_contato" value={formData.telefones_contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Separe múltiplos por ;</p>
                    </div>
                  </div>
                </section>

                <section className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                  <h3 className="text-lg font-semibold pb-2 mb-4">Comercial / Pipeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                      <label htmlFor="origem" className="block text-sm font-medium mb-1">Origem</label>
                      <input id="origem" type="text" name="origem" value={formData.origem || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="sub-origem" className="block text-sm font-medium mb-1">Sub-Origem</label>
                      <input id="sub-origem" type="text" name="sub_origem" value={formData.sub_origem || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="etapa" className="block text-sm font-medium mb-1">Etapa</label>
                      <input id="etapa" type="text" name="etapa" value={formData.etapa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="mercado" className="block text-sm font-medium mb-1">Mercado</label>
                      <input id="mercado" type="text" name="mercado" value={formData.mercado || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="produto" className="block text-sm font-medium mb-1">Produto</label>
                      <input id="produto" type="text" name="produto" value={formData.produto || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="area" className="block text-sm font-medium mb-1">Área</label>
                      <input id="area" type="text" name="area" value={formData.area || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                  </div>
                </section>
            </div>

            <footer className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-end gap-3">
              {error && <p className="text-red-500 text-sm self-center mr-auto" role="alert">{error}</p>}
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && <FaSpinner className="animate-spin" />}
                {isUpdateMode ? 'Atualizar' : 'Cadastrar'}
              </button>
            </footer>
        </form>
      </div>
    </div>
    {debugOpen && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDebugOpen(false)}>
        <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-3xl p-4 shadow-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Debug – Perplexity</h3>
            <button onClick={() => setDebugOpen(false)} className="text-gray-500 hover:text-gray-800">Fechar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-semibold mb-1">Flattened (usado no formData)</p>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-64 overflow-auto">{JSON.stringify(enrichDebug?.flattened, null, 2)}</pre>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">JSON Parseado</p>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-64 overflow-auto">{JSON.stringify(enrichDebug?.parsedJson, null, 2)}</pre>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-semibold mb-1">Raw (conteúdo bruto)</p>
              <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-64 overflow-auto">{enrichDebug?.rawContent}</pre>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
