'use client';

import { useState, useEffect, FormEvent } from 'react';
import { FaSpinner } from 'react-icons/fa';
import type { CompanySuggestion } from '../lib/perplexity';

// --- Types ---
interface CompanyData {
  Nome_da_Empresa?: string; Site_Empresa?: string; País_Empresa?: string; Estado_Empresa?: string;
  Cidade_Empresa?: string; Logradouro_Empresa?: string; Numero_Empresa?: string; Bairro_Empresa?: string;
  Complemento_Empresa?: string; CEP_Empresa?: string; CNPJ_Empresa?: string; DDI_Empresa?: string;
  Telefones_Empresa?: string; Observacao_Empresa?: string;
}
interface ContactData {
  Nome_Contato?: string; Email_Contato?: string; Cargo_Contato?: string;
  DDI_Contato?: string; Telefones_Contato?: string;
}
interface CommercialData {
  Origem?: string; Sub_Origem?: string; Mercado?: string; Produto?: string; Área?: string;
  Etapa?: string; Funil?: string; Tipo_do_Serv_Comunicacao?: string; ID_do_Serv_Comunicacao?: string;
}
export interface FullCompanyPayload {
  Cliente_ID?: string;
  Empresa: CompanyData;
  Contato: ContactData;
  Comercial: CommercialData;
}
interface SavedCompany {
  Cliente_ID: string; Nome_da_Empresa: string; CNPJ_Empresa: string;
}
export interface NewCompanyModalProps {
  isOpen: boolean;
  initialData?: Partial<FullCompanyPayload>;
  onClose: () => void;
  onSaved: (company: SavedCompany) => void;
}

type CompanyForm = CompanySuggestion & {
  Cliente_ID?: string;
  Origem?: string;
  Sub_Origem?: string;
  Etapa?: string;
  Funil?: string;
  Tipo_do_Serv_Comunicacao?: string;
  ID_do_Serv_Comunicacao?: string;
};

// --- Normalization Utilities ---
const digits = (s?: string) => (s || '').replace(/\D/g, '');

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
    const d = digits(t);
    if (!d) return '';
    return d.startsWith('55') ? `+${d}` : `+55${d}`;
  }).filter(Boolean);
  return uniq.join('; ');
}

function applySuggestionToForm(current: CompanyForm, suggestion: Partial<CompanyForm>): CompanyForm {
  const s: Partial<CompanyForm> = { ...suggestion };

  if (s.CNPJ_Empresa) s.CNPJ_Empresa = digits(s.CNPJ_Empresa);
  if (s.Estado_Empresa) s.Estado_Empresa = normalizeUF(s.Estado_Empresa);
  if (s.Telefones_Empresa) s.Telefones_Empresa = normalizePhones(s.Telefones_Empresa);
  if (s.Telefones_Contato) s.Telefones_Contato = normalizePhones(s.Telefones_Contato);
  if (s.DDI_Empresa && !s.DDI_Empresa.startsWith('+')) s.DDI_Empresa = `+${digits(s.DDI_Empresa) || '55'}`;
  if (s.DDI_Contato && !s.DDI_Contato.startsWith('+')) s.DDI_Contato = `+${digits(s.DDI_Contato) || '55'}`;
  if (s.Pais_Empresa === undefined) s.Pais_Empresa = 'Brasil';

  const next: CompanyForm = { ...current };

  (Object.keys(s) as (keyof CompanyForm)[]).forEach((key) => {
    const cur = (next[key] ?? '').toString().trim();
    const val = (s[key] ?? '').toString().trim();
    if (!cur && val) next[key] = val as any;
  });

  return next;
}

// --- Initial State ---
const initialForm: CompanyForm = {
  Nome_da_Empresa: '',
  Site_Empresa: '',
  Pais_Empresa: 'Brasil',
  Estado_Empresa: '',
  Cidade_Empresa: '',
  Logradouro_Empresa: '',
  Numero_Empresa: '',
  Bairro_Empresa: '',
  Complemento_Empresa: '',
  CEP_Empresa: '',
  CNPJ_Empresa: '',
  DDI_Empresa: '+55',
  Telefones_Empresa: '',
  Observacao_Empresa: '',
  Nome_Contato: '',
  Email_Contato: '',
  Cargo_Contato: '',
  DDI_Contato: '+55',
  Telefones_Contato: '',
  Mercado: '',
  Produto: '',
  Area: '',
  Origem: 'Cadastro Manual',
  Sub_Origem: 'Modal PER/DCOMP',
  Etapa: 'Novo',
  Funil: 'Padrão',
  Tipo_do_Serv_Comunicacao: '',
  ID_do_Serv_Comunicacao: '',
};

// --- Component ---
export default function NewCompanyModal({ isOpen, initialData, onClose, onSaved }: NewCompanyModalProps) {
  const [form, setFormData] = useState<CompanyForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpdateMode = !!form.Cliente_ID;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialData) {
        const flat: CompanyForm = {
          ...initialForm,
          ...(initialData.Empresa || {}),
          ...(initialData.Contato || {}),
          ...(initialData.Comercial || {}),
          Pais_Empresa: initialData.Empresa?.País_Empresa ?? initialForm.Pais_Empresa,
          Area: (initialData.Comercial as any)?.Área ?? initialForm.Area,
          Cliente_ID: initialData.Cliente_ID,
        };
        delete (flat as any)['País_Empresa'];
        delete (flat as any)['Área'];
        setFormData(flat);
      } else {
        setFormData(initialForm);
      }
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function handleEnrich() {
    setIsEnriching(true);
    try {
      const resp = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.Nome_da_Empresa,
          cnpj: form.CNPJ_Empresa,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const { suggestion } = await resp.json();
      setFormData((prev) => applySuggestionToForm(prev, suggestion));
    } catch (e) {
      console.error('Erro ao enriquecer:', e);
    } finally {
      setIsEnriching(false);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.Nome_da_Empresa) {
      setError('O "Nome da Empresa" é obrigatório.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload: FullCompanyPayload = {
        Cliente_ID: form.Cliente_ID,
        Empresa: {
          Nome_da_Empresa: form.Nome_da_Empresa,
          Site_Empresa: form.Site_Empresa,
          País_Empresa: form.Pais_Empresa,
          Estado_Empresa: form.Estado_Empresa,
          Cidade_Empresa: form.Cidade_Empresa,
          Logradouro_Empresa: form.Logradouro_Empresa,
          Numero_Empresa: form.Numero_Empresa,
          Bairro_Empresa: form.Bairro_Empresa,
          Complemento_Empresa: form.Complemento_Empresa,
          CEP_Empresa: form.CEP_Empresa,
          CNPJ_Empresa: form.CNPJ_Empresa,
          DDI_Empresa: form.DDI_Empresa,
          Telefones_Empresa: form.Telefones_Empresa,
          Observacao_Empresa: form.Observacao_Empresa,
        },
        Contato: {
          Nome_Contato: form.Nome_Contato,
          Email_Contato: form.Email_Contato,
          Cargo_Contato: form.Cargo_Contato,
          DDI_Contato: form.DDI_Contato,
          Telefones_Contato: form.Telefones_Contato,
        },
        Comercial: {
          Origem: form.Origem,
          Sub_Origem: form.Sub_Origem,
          Mercado: form.Mercado,
          Produto: form.Produto,
          Área: form.Area,
          Etapa: form.Etapa,
          Funil: form.Funil,
          Tipo_do_Serv_Comunicacao: form.Tipo_do_Serv_Comunicacao,
          ID_do_Serv_Comunicacao: form.ID_do_Serv_Comunicacao,
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
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
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
                {/* --- Dados da Empresa --- */}
                <section>
                  <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    <div className="md:col-span-2">
                      <label htmlFor="nome-empresa" className="block text-sm font-medium mb-1">Nome da Empresa *</label>
                      <input id="nome-empresa" type="text" name="Nome_da_Empresa" value={form.Nome_da_Empresa || ''} onChange={handleChange} required aria-required="true" className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="cnpj-empresa" className="block text-sm font-medium mb-1">CNPJ Empresa</label>
                      <input id="cnpj-empresa" type="text" name="CNPJ_Empresa" value={form.CNPJ_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Apenas dígitos; validado no envio.</p>
                      <button
                        type="button"
                        onClick={handleEnrich}
                        disabled={isEnriching}
                        className="mt-2 px-3 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60 flex items-center gap-2"
                      >
                        {isEnriching && <FaSpinner className="animate-spin" />}
                        Enriquecer
                      </button>
                    </div>
                    <div>
                      <label htmlFor="site-empresa" className="block text-sm font-medium mb-1">Site Empresa</label>
                      <input id="site-empresa" type="url" name="Site_Empresa" placeholder="https://..." value={form.Site_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="logradouro-empresa" className="block text-sm font-medium mb-1">Logradouro</label>
                            <input id="logradouro-empresa" type="text" name="Logradouro_Empresa" value={form.Logradouro_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                        <div>
                            <label htmlFor="numero-empresa" className="block text-sm font-medium mb-1">Número</label>
                            <input id="numero-empresa" type="text" name="Numero_Empresa" value={form.Numero_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                        <div>
                            <label htmlFor="bairro-empresa" className="block text-sm font-medium mb-1">Bairro</label>
                            <input id="bairro-empresa" type="text" name="Bairro_Empresa" value={form.Bairro_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                        </div>
                    </div>
                    <div>
                      <label htmlFor="cidade-empresa" className="block text-sm font-medium mb-1">Cidade</label>
                      <input id="cidade-empresa" type="text" name="Cidade_Empresa" value={form.Cidade_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="estado-empresa" className="block text-sm font-medium mb-1">Estado (UF)</label>
                      <input id="estado-empresa" type="text" name="Estado_Empresa" value={form.Estado_Empresa || ''} onChange={e => setFormData(prev => ({ ...prev, Estado_Empresa: e.target.value.toUpperCase() }))} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Use a sigla, ex.: SP</p>
                    </div>
                    <div>
                      <label htmlFor="cep-empresa" className="block text-sm font-medium mb-1">CEP</label>
                      <input id="cep-empresa" type="text" name="CEP_Empresa" value={form.CEP_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Formato 00000-000</p>
                    </div>
                    <div>
                      <label htmlFor="pais-empresa" className="block text-sm font-medium mb-1">País</label>
                      <input id="pais-empresa" type="text" name="Pais_Empresa" value={form.Pais_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="ddi-empresa" className="block text-sm font-medium mb-1">DDI Empresa</label>
                      <input id="ddi-empresa" type="text" name="DDI_Empresa" value={form.DDI_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="telefones-empresa" className="block text-sm font-medium mb-1">Telefones Empresa</label>
                      <input id="telefones-empresa" type="text" name="Telefones_Empresa" value={form.Telefones_Empresa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Separe múltiplos por ;</p>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="obs-empresa" className="block text-sm font-medium mb-1">Observação</label>
                      <textarea id="obs-empresa" name="Observacao_Empresa" value={form.Observacao_Empresa || ''} onChange={handleChange} rows={3} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                  </div>
                </section>

                <section className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                  <h3 className="text-lg font-semibold pb-2 mb-4">Dados de Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nome-contato" className="block text-sm font-medium mb-1">Nome Contato</label>
                      <input id="nome-contato" type="text" name="Nome_Contato" value={form.Nome_Contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="cargo-contato" className="block text-sm font-medium mb-1">Cargo Contato</label>
                      <input id="cargo-contato" type="text" name="Cargo_Contato" value={form.Cargo_Contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="email-contato" className="block text-sm font-medium mb-1">E-mail Contato</label>
                      <input id="email-contato" type="email" name="Email_Contato" value={form.Email_Contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="ddi-contato" className="block text-sm font-medium mb-1">DDI Contato</label>
                      <input id="ddi-contato" type="text" name="DDI_Contato" value={form.DDI_Contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="telefones-contato" className="block text-sm font-medium mb-1">Telefones Contato</label>
                      <input id="telefones-contato" type="text" name="Telefones_Contato" value={form.Telefones_Contato || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                      <p className="text-xs text-gray-500 mt-1">Separe múltiplos por ;</p>
                    </div>
                  </div>
                </section>

                <section className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                  <h3 className="text-lg font-semibold pb-2 mb-4">Comercial / Pipeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                      <label htmlFor="origem" className="block text-sm font-medium mb-1">Origem</label>
                      <input id="origem" type="text" name="Origem" value={form.Origem || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="sub-origem" className="block text-sm font-medium mb-1">Sub-Origem</label>
                      <input id="sub-origem" type="text" name="Sub_Origem" value={form.Sub_Origem || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="etapa" className="block text-sm font-medium mb-1">Etapa</label>
                      <input id="etapa" type="text" name="Etapa" value={form.Etapa || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                    <div>
                      <label htmlFor="mercado" className="block text-sm font-medium mb-1">Mercado</label>
                      <input id="mercado" type="text" name="Mercado" value={form.Mercado || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="produto" className="block text-sm font-medium mb-1">Produto</label>
                      <input id="produto" type="text" name="Produto" value={form.Produto || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                     <div>
                      <label htmlFor="area" className="block text-sm font-medium mb-1">Área</label>
                      <input id="area" type="text" name="Area" value={form.Area || ''} onChange={handleChange} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"/>
                    </div>
                  </div>
                </section>
            </div>

            <footer className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-end gap-3">
              {error && <p className="text-red-500 text-sm self-center mr-auto" role="alert">{error}</p>}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-400 flex items-center gap-2"
              >
                {isLoading && <FaSpinner className="animate-spin" />}
                {isUpdateMode ? 'Atualizar' : 'Cadastrar'}
              </button>
            </footer>
        </form>
      </div>
    </div>
  );
}

