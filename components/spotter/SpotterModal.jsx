'use client';

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaSpinner } from "react-icons/fa";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

const fieldMap = {
  "Nome do Lead": "nomeLead",
  "Origem": "origem",
  "Sub-Origem": "subOrigem",
  "Mercado": "mercado",
  "Produto": "produto",
  "Site": "site",
  "País": "pais",
  "Estado": "estado",
  "Cidade": "cidade",
  "Logradouro": "logradouro",
  "Número": "numero",
  "Bairro": "bairro",
  "Complemento": "complemento",
  "CEP": "cep",
  "DDI": "ddi",
  "Telefones": "telefones",
  "Observação": "observacao",
  "CPF/CNPJ": "cpfCnpj",
  "Nome Contato": "nomeContato",
  "E-mail Contato": "emailContato",
  "Cargo Contato": "cargoContato",
  "DDI Contato": "ddiContato",
  "Telefones Contato": "telefonesContato",
  "Tipo do Serv. Comunicação": "tipoServComunicacao",
  "ID do Serv. Comunicação": "idServComunicacao",
  "Área": "area",
  "Nome da Empresa": "nomeEmpresa",
  "Etapa": "etapa",
  "Funil": "funil",
  "Email Pré-vendedor": "emailPrevendedor",
};

const reversedFieldMap = Object.entries(fieldMap).reduce((acc, [layoutKey, formKey]) => {
  acc[formKey] = layoutKey;
  return acc;
}, {});
export default function SpotterModal({ open, onOpenChange, lead, onSubmit, isSubmitting = false }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEnrichConfirmOpen, setIsEnrichConfirmOpen] = useState(false);
  const [produtosList, setProdutosList] = useState([]);
  const [mercadosList, setMercadosList] = useState([]);
  const [prevendedoresList, setPrevendedoresList] = useState([]);

  useEffect(() => {
    if (!open) return;

    const fetchAndPrefill = async () => {
      let fetchedMercados = [];
      try {
        const res = await fetch("/api/padroes");
        const data = await res.json();
        if (res.ok) {
          setProdutosList(Array.isArray(data.produtos) ? data.produtos : []);
          fetchedMercados = Array.isArray(data.mercados) ? data.mercados : [];
          setMercadosList(fetchedMercados);
          setPrevendedoresList(Array.isArray(data.prevendedores) ? data.prevendedores : []);
        }
      } catch (error) {
        console.error("Failed to fetch padroes", error);
      }

      const client = lead ?? undefined;
      const initialMarket = client?.segment ?? "";
      const foundMarket = fetchedMercados.find((m) => m.toLowerCase() === initialMarket.toLowerCase());
      const selectedMarket = foundMarket || "N/A";

      if (selectedMarket === "N/A" && !fetchedMercados.includes("N/A")) {
        setMercadosList((prev) => [...prev, "N/A"]);
      }

      const firstContact = client?.contacts?.[0];
      const telefonesEmpresa =
        firstContact?.normalizedPhones?.join(";") || client?.normalizedPhones?.join(";") || "";

      const initialFormState = {
        [fieldMap["Nome do Lead"]]: client?.company ?? "Lead sem título",
        [fieldMap["Origem"]]: "Lista Francisco",
        [fieldMap["Mercado"]]: selectedMarket,
        [fieldMap["Produto"]]: client?.produto ?? "",
        [fieldMap["Telefones"]]: telefonesEmpresa,
        [fieldMap["Área"]]: Array.isArray(client?.opportunities) && client?.opportunities.length
          ? client.opportunities.join(";")
          : client?.segment ?? "Geral",
        [fieldMap["Etapa"]]: "Entrada",
        [fieldMap["Funil"]]: "Padrão",
        [fieldMap["Nome da Empresa"]]: client?.company ?? "",
        [fieldMap["Nome Contato"]]: firstContact?.name ?? firstContact?.nome ?? "",
        [fieldMap["E-mail Contato"]]:
          firstContact?.email?.split(";")[0].trim() ?? process.env.NEXT_PUBLIC_DEFAULT_CONTACT_EMAIL ?? "",
        [fieldMap["Telefones Contato"]]: firstContact?.normalizedPhones?.join(";") ?? "",
        [fieldMap["Cargo Contato"]]: firstContact?.role ?? firstContact?.cargo ?? "",
        [fieldMap["CPF/CNPJ"]]: client?.document ?? client?.cnpj ?? client?.cpf ?? "",
        [fieldMap["Estado"]]: client?.uf ?? "",
        [fieldMap["Cidade"]]: client?.city ?? "",
        [fieldMap["País"]]: client?.country ?? (client?.city ? "Brasil" : ""),
        [fieldMap["DDI"]]: "55",
        [fieldMap["DDI Contato"]]: "55",
        [fieldMap["Site"]]: client?.site ?? "",
        [fieldMap["Sub-Origem"]]: client?.subOrigem ?? "",
        [fieldMap["Observação"]]: client?.observacao ?? client?.opportunitiesDescription ?? "",
        [fieldMap["Logradouro"]]: client?.logradouro ?? "",
        [fieldMap["Número"]]: client?.numero ?? "",
        [fieldMap["Bairro"]]: client?.bairro ?? "",
        [fieldMap["Complemento"]]: client?.complemento ?? "",
        [fieldMap["CEP"]]: client?.cep ?? "",
        [fieldMap["Tipo do Serv. Comunicação"]]: client?.tipoServComunicacao ?? "",
        [fieldMap["ID do Serv. Comunicação"]]: client?.idServComunicacao ?? "",
        [fieldMap["Email Pré-vendedor"]]: client?.emailPrevendedor ?? "",
      };

      const fullForm = Object.values(fieldMap).reduce((acc, key) => {
        if (!(key in acc)) {
          acc[key] = "";
        }
        return acc;
      }, { ...initialFormState });

      setFormData(fullForm);
      setErrors([]);
    };

    fetchAndPrefill();
  }, [open, lead]);

  useEffect(() => {
    if (!open) {
      setErrors([]);
    }
  }, [open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEnrich = () => {
    const companyName = formData[fieldMap["Nome da Empresa"]];
    if (!companyName) {
      alert("Por favor, preencha o nome da empresa para enriquecer.");
      return;
    }
    setIsEnrichConfirmOpen(true);
  };

  const handleEnrichConfirm = async () => {
    const companyName = formData[fieldMap["Nome da Empresa"]];
    setIsEnrichConfirmOpen(false);
    if (!companyName) return;

    setIsEnriching(true);
    setErrors([]);
    try {
      const res = await fetch("/api/empresas/enriquecer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: companyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao enriquecer");
      }

      const suggestion = data.suggestion ?? {};
      setFormData((prev) => {
        const next = { ...prev };
        for (const layoutKey in suggestion) {
          const formKey = fieldMap[layoutKey];
          if (formKey && !next[formKey]) {
            next[formKey] = suggestion[layoutKey];
          }
        }
        if (suggestion.Mercado) {
          const foundMarket = mercadosList.find((m) => m.toLowerCase() === suggestion.Mercado.toLowerCase());
          if (foundMarket) {
            next[fieldMap["Mercado"]] = foundMarket;
          }
        }
        return next;
      });
      alert("Dados enriquecidos com sucesso!");
    } catch (error) {
      alert(`Erro ao enriquecer: ${error?.message ?? error}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setErrors([]);

    const payloadForApi = Object.entries(formData).reduce((acc, [formKey, value]) => {
      const layoutKey = reversedFieldMap[formKey];
      if (layoutKey) {
        acc[layoutKey] = value || null;
      }
      return acc;
    }, {});

    try {
      await onSubmit(payloadForApi);
    } catch (error) {
      const details = error?.details;
      if (Array.isArray(details)) {
        setErrors(details);
      } else if (error?.message) {
        console.error("Erro no envio ao Spotter:", error);
      }
    }
  };

  const renderInput = (label, key, props = {}) => {
    const error = errors.find((e) => e.field === label);
    const baseClasses =
      "w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    return (
      <div>
        <label htmlFor={key} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {props.required ? " *" : ""}
        </label>
        <input
          id={key}
          name={key}
          value={formData[key] ?? ""}
          onChange={handleChange}
          {...props}
          className={cn(
            baseClasses,
            error ? "border-red-500" : "border-border",
            props.className,
          )}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
      </div>
    );
  };

  const renderSelect = (label, key, options, props = {}) => {
    const error = errors.find((e) => e.field === label);
    const baseClasses =
      "w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    return (
      <div>
        <label htmlFor={key} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {props.required ? " *" : ""}
        </label>
        <select
          id={key}
          name={key}
          value={formData[key] ?? ""}
          onChange={handleChange}
          {...props}
          className={cn(
            baseClasses,
            error ? "border-red-500" : "border-border",
            props.className,
          )}
        >
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
      </div>
    );
  };

  const modalTitle = useMemo(() => {
    return lead?.company ? `Enviar ${lead.company} ao Spotter` : "Enviar ao Spotter";
  }, [lead?.company]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="spotter-modal-description"
        className="max-h-[90vh] overflow-hidden p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <p id="spotter-modal-description" className="text-sm text-muted-foreground">
            Confirme ou ajuste os dados antes do envio.
          </p>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
          className="flex max-h-[calc(90vh-150px)] flex-col"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {renderInput("Nome do Lead", fieldMap["Nome do Lead"], { required: true })}
              {renderInput("Nome da Empresa", fieldMap["Nome da Empresa"])}
              <div>
                <label htmlFor={fieldMap["CPF/CNPJ"]} className="mb-1 block text-sm font-medium text-foreground">
                  CPF/CNPJ
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={fieldMap["CPF/CNPJ"]}
                    name={fieldMap["CPF/CNPJ"]}
                    value={formData[fieldMap["CPF/CNPJ"]] ?? ""}
                    onChange={handleChange}
                    className="flex-1 rounded border border-border bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const query = encodeURIComponent(`${formData[fieldMap["Nome da Empresa"]]} CNPJ`);
                      window.open(`https://www.google.com/search?q=${query}`, "_blank");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/60 text-sm text-muted-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Pesquisar CNPJ no Google"
                    title="Pesquisar CNPJ no Google"
                  >
                    <FaSearch />
                  </button>
                </div>
              </div>
              {renderInput("Site", fieldMap["Site"], { type: "url" })}
              {renderInput("Sub-Origem", fieldMap["Sub-Origem"])}
              {renderSelect("Mercado", fieldMap["Mercado"], mercadosList, { required: true })}
              {renderSelect("Produto", fieldMap["Produto"], produtosList)}
              {renderSelect("Email Pré-vendedor", fieldMap["Email Pré-vendedor"], prevendedoresList)}
              {renderInput("Área", fieldMap["Área"], { required: true, placeholder: "Separar múltiplas por ;" })}
              {renderInput("Telefones", fieldMap["Telefones"], { required: true, placeholder: "Separar múltiplos por ;" })}
              {renderInput("Observação", fieldMap["Observação"])}

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Endereço</h3>
              {renderInput("País", fieldMap["País"])}
              {renderInput("Estado", fieldMap["Estado"])}
              {renderInput("Cidade", fieldMap["Cidade"])}
              {renderInput("Logradouro", fieldMap["Logradouro"])}
              {renderInput("Número", fieldMap["Número"])}
              {renderInput("Bairro", fieldMap["Bairro"])}
              {renderInput("Complemento", fieldMap["Complemento"])}
              {renderInput("CEP", fieldMap["CEP"])}

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Contato</h3>
              {renderInput("Nome Contato", fieldMap["Nome Contato"])}
              {renderInput("Cargo Contato", fieldMap["Cargo Contato"])}
              {renderInput("E-mail Contato", fieldMap["E-mail Contato"], { type: "email" })}
              {renderInput("Telefones Contato", fieldMap["Telefones Contato"], {
                placeholder: "Separar múltiplos por ;",
              })}

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Outros</h3>
              {renderInput("Tipo do Serv. Comunicação", fieldMap["Tipo do Serv. Comunicação"])}
              {renderInput("ID do Serv. Comunicação", fieldMap["ID do Serv. Comunicação"])}
            </div>
          </div>

          <DialogFooter className="w-full flex-col gap-3 border-t border-border/60 bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleEnrich}
              disabled={isEnriching || isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              {isEnriching && <FaSpinner className="animate-spin" />}
              Enriquecer com IA
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                disabled={isSubmitting || isEnriching}
                aria-label="Enviar ao Spotter"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <FaSpinner className="animate-spin" /> Enviando...
                  </span>
                ) : (
                  "Enviar ao Spotter"
                )}
              </button>
            </div>
          </DialogFooter>
        </form>

        {isEnrichConfirmOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/40">
            <div className="w-11/12 max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-foreground">Confirmar Enriquecimento</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Deseja buscar e atualizar os dados para a empresa
                <span className="font-semibold"> {formData[fieldMap["Nome da Empresa"]] || ""}</span>?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEnrichConfirmOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEnrichConfirm}
                  disabled={isEnriching}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                >
                  {isEnriching ? <FaSpinner className="animate-spin" /> : "Sim, enriquecer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
