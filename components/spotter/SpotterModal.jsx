'use client';

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaSpinner } from "react-icons/fa";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

const digitsOnly = (value) => String(value ?? "").replace(/\D+/g, "");

const normalizePhoneForSubmit = (rawPhone, rawDdi) => {
  const phoneDigits = digitsOnly(rawPhone);
  let phone = phoneDigits;
  let ddi = digitsOnly(rawDdi) || undefined;

  if (!phone) {
    return { ddi: undefined, phone: undefined };
  }

  if (!ddi && phone.startsWith("55") && phone.length > 11) {
    ddi = "55";
    phone = phone.slice(2);
  }

  if (phone.length >= 10 && phone.startsWith("0")) {
    phone = phone.slice(1);
  }

  if (!ddi && phone) {
    ddi = "55";
  }

  return { ddi, phone };
};

const fieldMap = {
  nome_do_lead: "nomeLead",
  origem: "origem",
  sub_origem: "subOrigem",
  mercado: "mercado",
  produto: "produto",
  site: "site",
  pais: "pais",
  estado: "estado",
  cidade: "cidade",
  logradouro: "logradouro",
  numero: "numero",
  bairro: "bairro",
  complemento: "complemento",
  cep: "cep",
  ddi: "ddi",
  telefones: "telefones",
  observacao: "observacao",
  cpf_cnpj: "cpfCnpj",
  nome_contato: "nomeContato",
  e_mail_contato: "emailContato",
  cargo_contato: "cargoContato",
  ddi_contato: "ddiContato",
  telefones_contato: "telefonesContato",
  tipo_do_serv_comunicacao: "tipoServComunicacao",
  id_do_serv_comunicacao: "idServComunicacao",
  area: "area",
  nome_da_empresa: "nomeEmpresa",
  etapa: "etapa",
  funil: "funil",
  email_prevendedor: "emailPrevendedor",
};

export default function SpotterModal({ open, onOpenChange, lead, onSubmit, isSubmitting = false }) {
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEnrichConfirmOpen, setIsEnrichConfirmOpen] = useState(false);
  const [produtosList, setProdutosList] = useState([]);
  const [mercadosList, setMercadosList] = useState([]);
  const [prevendedoresList, setPrevendedoresList] = useState([]);

  const [funnels, setFunnels] = useState([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [selectedStageName, setSelectedStageName] = useState("");
  const [prefillFunnelName, setPrefillFunnelName] = useState("");
  const [stageError, setStageError] = useState(null);

  const isProcessing = isSubmitting || isSubmittingLocal;

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch('/api/spotter/funnels', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao listar funis');
        const data = await res.json();
        const rawFunnels = Array.isArray(data?.pipelines)
          ? data.pipelines
          : Array.isArray(data?.value)
            ? data.value
            : [];
        const normalizedFunnels = rawFunnels.map((funnel) => {
          const numericId = Number(funnel?.id);
          const id = Number.isFinite(numericId)
            ? String(numericId)
            : String(funnel?.id ?? funnel?.name ?? '');
          const seenStages = new Set();
          const stageNames = Array.isArray(funnel?.stageNames)
            ? funnel.stageNames
                .map((stage) => String(stage ?? '').trim())
                .filter((stage) => {
                  if (!stage || seenStages.has(stage)) return false;
                  seenStages.add(stage);
                  return true;
                })
            : [];
          return {
            id,
            numericId: Number.isFinite(numericId) ? numericId : undefined,
            name: String(funnel?.name ?? funnel?.value ?? '').trim() || `Funil ${id}`,
            stageNames,
          };
        });
        setFunnels(normalizedFunnels);
      } catch (e) {
        console.warn('[Spotter] Falha ao buscar funis', e);
        setFunnels([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!selectedFunnelId) {
      setSelectedStageName('');
      setStageError(null);
      return;
    }

    const currentFunnel = funnels.find((funnel) => funnel.id === selectedFunnelId);
    if (!currentFunnel) {
      setSelectedStageName('');
      return;
    }

    if (selectedStageName && !currentFunnel.stageNames.includes(selectedStageName)) {
      setSelectedStageName('');
    }
  }, [selectedFunnelId, selectedStageName, funnels]);

  const handleFunnelChange = (e) => {
    const id = String(e.target.value || '');
    setSelectedFunnelId(id);
    setSelectedStageName('');
    setStageError(null);
  };

  const handleStageChange = (e) => {
    const name = String(e.target.value || '');
    setSelectedStageName(name);
    setStageError(null);
  };

  const handleSubmitClick = () => {
    // Native HTML validation removed - only API validation will be used
  };

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
      const initialMarket = client?.organizacao_segmento ?? "";
      const foundMarket = fetchedMercados.find((m) => m.toLowerCase() === initialMarket.toLowerCase());
      const selectedMarket = foundMarket || "N/A";

      if (selectedMarket === "N/A" && !fetchedMercados.includes("N/A")) {
        setMercadosList((prev) => [...prev, "N/A"]);
      }

      const firstContact = client?.contacts?.[0];
      const telefonesEmpresa =
        firstContact?.normalizedPhones?.join(";") || client?.normalizedPhones?.join(";") || "";

      const initialFormState = {
        [fieldMap["nome_do_lead"]]: client?.nome_da_empresa ?? "Lead sem título",
        [fieldMap["origem"]]: "Lista Francisco",
        [fieldMap["mercado"]]: selectedMarket,
        [fieldMap["produto"]]: client?.produto ?? "",
        [fieldMap["telefones"]]: telefonesEmpresa,
        [fieldMap["area"]]: Array.isArray(client?.opportunities) && client?.opportunities.length
          ? client.opportunities.join(";")
          : client?.organizacao_segmento ?? "Geral",
        [fieldMap["nome_da_empresa"]]: client?.nome_da_empresa ?? "",
        [fieldMap["nome_contato"]]: firstContact?.name ?? firstContact?.nome ?? "",
        [fieldMap["e_mail_contato"]]:
          firstContact?.email?.split(";")[0].trim() ?? process.env.NEXT_PUBLIC_DEFAULT_CONTACT_EMAIL ?? "",
        [fieldMap["telefones_contato"]]: firstContact?.normalizedPhones?.join(";") ?? "",
        [fieldMap["cargo_contato"]]: firstContact?.role ?? firstContact?.cargo ?? "",
        [fieldMap["cpf_cnpj"]]: client?.cpf_cnpj ?? "",
        [fieldMap["estado"]]: client?.estado_empresa ?? "",
        [fieldMap["cidade"]]: client?.cidade_empresa ?? "",
        [fieldMap["pais"]]: client?.pais_empresa ?? (client?.cidade_empresa ? "Brasil" : ""),
        [fieldMap["ddi"]]: "55",
        [fieldMap["ddi_contato"]]: "55",
        [fieldMap["site"]]: client?.site_empresa ?? "",
        [fieldMap["sub_origem"]]: client?.sub_origem ?? "",
        [fieldMap["observacao"]]: client?.observacao_empresa ?? client?.opportunitiesDescription ?? "",
        [fieldMap["logradouro"]]: client?.logradouro_empresa ?? "",
        [fieldMap["numero"]]: client?.numero_empresa ?? "",
        [fieldMap["bairro"]]: client?.bairro_empresa ?? "",
        [fieldMap["complemento"]]: client?.complemento_empresa ?? "",
        [fieldMap["cep"]]: client?.cep_empresa ?? "",
        [fieldMap["tipo_do_serv_comunicacao"]]: client?.tipo_do_serv_comunicacao ?? "",
        [fieldMap["id_do_serv_comunicacao"]]: client?.id_do_serv_comunicacao ?? "",
        [fieldMap["email_prevendedor"]]: client?.email_prevendedor ?? "",
      };

      const fullForm = Object.values(fieldMap).reduce((acc, key) => {
        if (!(key in acc)) {
          acc[key] = "";
        }
        return acc;
      }, { ...initialFormState });

      setFormData(fullForm);
      setFormErrors({});
      setPrefillFunnelName("Pré-venda");
    };

    fetchAndPrefill();
  }, [open, lead]);

  useEffect(() => {
    if (!open) {
      setFormErrors({});
      setFunnels([]);
      setSelectedFunnelId('');
      setSelectedStageName('');
      setStageError(null);
    }
  }, [open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const readValue = (label) => {
    const key = fieldMap[label];
    if (!key) return "";
    const value = formData[key];
    if (value == null) return "";
    return typeof value === "string" ? value : String(value);
  };

  const readTrimmedValue = (label) => readValue(label).trim();

  const valueOrUndefined = (label) => {
    const value = readTrimmedValue(label);
    return value ? value : undefined;
  };

  const handleEnrich = () => {
    const companyName = formData[fieldMap["nome_da_empresa"]];
    if (!companyName) {
      toast.warning("Por favor, preencha o nome da empresa para enriquecer.");
      return;
    }
    setIsEnrichConfirmOpen(true);
  };

  const handleEnrichConfirm = async () => {
    const companyName = formData[fieldMap["nome_da_empresa"]];
    setIsEnrichConfirmOpen(false);
    if (!companyName) return;

    setIsEnriching(true);
    setFormErrors({});
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
        if (suggestion.mercado) {
          const foundMarket = mercadosList.find((m) => m.toLowerCase() === suggestion.mercado.toLowerCase());
          if (foundMarket) {
            next[fieldMap["mercado"]] = foundMarket;
          }
        }
        return next;
      });
      toast.success("Dados enriquecidos com sucesso!");
    } catch (error) {
      toast.error(`Erro ao enriquecer: ${error?.message ?? error}`);
    } finally {
      setIsEnriching(false);
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setStageError(null);

    const currentFunnel = funnels.find((funnel) => funnel.id === selectedFunnelId);
    if (!currentFunnel) {
      toast.error("Selecione um funil para enviar ao Spotter.");
      return;
    }

    if (!selectedStageName) {
      const message = "Selecione uma etapa válida para o funil escolhido.";
      setStageError(message);
      toast.error(message);
      return;
    }

    if (Array.isArray(currentFunnel.stageNames) && currentFunnel.stageNames.length === 0) {
      const message = "Este funil não possui etapas disponíveis no momento.";
      setStageError(message);
      toast.error(message);
      return;
    }

    const trimmedStageName = selectedStageName.trim();

    if (Array.isArray(currentFunnel.stageNames) && !currentFunnel.stageNames.includes(trimmedStageName)) {
      const message = `A etapa selecionada não pertence ao funil ${currentFunnel.name}.`;
      setStageError(message);
      toast.error(message);
      return;
    }

    const numericFunnelId = currentFunnel.numericId ?? Number(currentFunnel.id);
    if (!Number.isFinite(numericFunnelId)) {
      toast.error("Funil selecionado inválido. Tente novamente.");
      return;
    }

    const rawPhones = readValue("telefones")
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const primaryPhone = normalizePhoneForSubmit(rawPhones[0]);
    const secondaryPhone = normalizePhoneForSubmit(rawPhones[1]);

    const payload = {
      nomeLead: readTrimmedValue("nome_do_lead"),
      origem: readTrimmedValue("origem"),
      mercado: readTrimmedValue("mercado"),
      pais: readTrimmedValue("pais"),
      estado: readTrimmedValue("estado"),
      cidade: readTrimmedValue("cidade"),
      telefones: readValue("telefones"),
      nomeContato: readTrimmedValue("nome_contato"),
      telefonesContato: readValue("telefones_contato"),
      emailContato: readTrimmedValue("e_mail_contato"),
      tipoServCom: readTrimmedValue("tipo_do_serv_comunicacao"),
      idServCom: readTrimmedValue("id_do_serv_comunicacao"),
      area: readValue("area"),
      funilId: numericFunnelId,
      stage: trimmedStageName,
      etapaNome: trimmedStageName,
      address: readTrimmedValue("logradouro"),
      addressNumber: readTrimmedValue("numero"),
      addressComplement: readTrimmedValue("complemento"),
      neighborhood: readTrimmedValue("bairro"),
      zipcode: readTrimmedValue("cep"),
      subSource: valueOrUndefined("sub_origem"),
      subOrigem: valueOrUndefined("sub_origem"),
      leadProduct: valueOrUndefined("produto"),
      produto: valueOrUndefined("produto"),
      website: valueOrUndefined("site"),
      site: valueOrUndefined("site"),
      cpfcnpj: valueOrUndefined("cpf_cnpj"),
      observacao: valueOrUndefined("observacao"),
      description: valueOrUndefined("observacao"),
      emailPrevendedor: valueOrUndefined("email_prevendedor"),
      nomeEmpresa: valueOrUndefined("nome_da_empresa"),
      cargoContato: valueOrUndefined("cargo_contato"),
      ddiContato: valueOrUndefined("ddi_contato"),
      logradouro: valueOrUndefined("logradouro"),
      numero: valueOrUndefined("numero"),
      complemento: valueOrUndefined("complemento"),
      bairro: valueOrUndefined("bairro"),
      cep: valueOrUndefined("cep"),
      tipoServComunicacao: readTrimmedValue("tipo_do_serv_comunicacao"),
      idServComunicacao: readTrimmedValue("id_do_serv_comunicacao"),
      ddiPhone: primaryPhone.phone ? primaryPhone.ddi : undefined,
      phone: primaryPhone.phone || undefined,
      ddiPhone2: secondaryPhone.phone ? secondaryPhone.ddi : undefined,
      phone2: secondaryPhone.phone || undefined,
    };

    setIsSubmittingLocal(true);
    try {
      if (!onSubmit) {
        throw new Error("Função de envio ao Spotter não definida.");
      }
      await onSubmit(payload);
      toast.success("Enviado ao Spotter com sucesso!", {
        theme: "colored",
        style: { background: "#16a34a", color: "#ffffff" },
      });

      try {
        const cardId = lead?.id ?? null;
        fetch("/api/sheets/cor-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, cor: "purple" }),
        }).catch(() => {});
      } catch (_) {
      }
      onOpenChange?.(false);
    } catch (err) {
      let errorMessage = err?.message || "Falha ao enviar ao Spotter";
      let stageErrorMessage = null;

      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        const fieldErrorMessages = [];
        const stageMessages = [];
        Object.entries(err.fieldErrors).forEach(([field, messages]) => {
          const messageArray = Array.isArray(messages) ? messages : [messages];
          if (field === 'stage' || field === 'etapaNome') {
            stageMessages.push(...messageArray);
            return;
          }
          messageArray.forEach((msg) => {
            fieldErrorMessages.push(`${field}: ${msg}`);
          });
        });

        if (stageMessages.length > 0) {
          stageErrorMessage = stageMessages.join(' | ');
          setStageError(stageErrorMessage);
          errorMessage = stageErrorMessage;
        } else if (fieldErrorMessages.length > 0) {
          errorMessage = fieldErrorMessages.join(' | ');
        }
      }

      if (Array.isArray(err?.messages) && err.messages.length > 0) {
        errorMessage = err.messages.join(' | ');
        if (!stageErrorMessage) {
          const stageMsg = err.messages.find((msg) => msg.toLowerCase().includes('etapa'));
          if (stageMsg) {
            stageErrorMessage = err.messages.join(' | ');
            setStageError(stageErrorMessage);
          }
        }
      }

      if (!stageErrorMessage && typeof err?.message === 'string' && err.message.toLowerCase().includes('etapa')) {
        stageErrorMessage = err.message;
        setStageError(stageErrorMessage);
        errorMessage = stageErrorMessage;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const renderInput = (label, key, props = {}) => {
    const errorMessage = formErrors?.[key];
    const baseClasses =
      "w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    
    const { required, type, ...cleanProps } = props;
    const showRequired = required || props.required;
    
    return (
      <div>
        <label htmlFor={key} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {showRequired ? " *" : ""}
        </label>
        <input
          id={key}
          name={key}
          type="text"
          value={formData[key] ?? ""}
          onChange={handleChange}
          {...cleanProps}
          className={cn(
            baseClasses,
            errorMessage ? "border-red-500" : "border-border",
            cleanProps.className,
          )}
          aria-invalid={Boolean(errorMessage)}
        />
        {errorMessage && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
      </div>
    );
  };

  const renderSelect = (label, key, options, props = {}) => {
    const errorMessage = formErrors?.[key];
    const { placeholder, className, required, ...selectProps } = props;
    const showRequired = required;
    const baseClasses =
      "w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    const normalizedOptions = Array.isArray(options)
      ? options.map((opt) =>
          typeof opt === "string"
            ? { value: opt, label: opt }
            : { value: String(opt.value ?? opt.id ?? opt.label ?? ""), label: opt.label ?? opt.name ?? opt.value ?? "" },
        )
      : [];
    return (
      <div>
        <label htmlFor={key} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {showRequired ? " *" : ""}
        </label>
        <select
          id={key}
          name={key}
          {...selectProps}
          className={cn(
            baseClasses,
            errorMessage ? "border-red-500" : "border-border",
            className,
          )}
          aria-invalid={Boolean(errorMessage)}
        >
          <option value="">{placeholder ?? "Selecione..."}</option>
          {normalizedOptions.map((opt) => (
            <option key={`${key}-${opt.value}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errorMessage && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
      </div>
    );
  };

  const hasFunnels = Array.isArray(funnels) && funnels.length > 0;
  const selectedFunnel = funnels.find((funnel) => funnel.id === selectedFunnelId);
  const stageList = Array.isArray(selectedFunnel?.stageNames) ? selectedFunnel.stageNames : [];
  const hasStagesForFunnel = stageList.length > 0;

  const modalTitle = useMemo(() => {
    return lead?.nome_da_empresa ? `Enviar ${lead.nome_da_empresa} ao Spotter` : "Enviar ao Spotter";
  }, [lead?.nome_da_empresa]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      aria-describedby="spotter-modal-desc"
      className="max-h-[90vh] overflow-hidden p-0"
      onClick={(event) => event.stopPropagation()}
    >
      <DialogDescription id="spotter-modal-desc" className="sr-only">
        Confirme ou ajuste os dados antes do envio ao Spotter. Campos obrigatórios marcados com asterisco.
      </DialogDescription>
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>
        <form
          id="spotter-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          noValidate
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          className="flex max-h-[calc(90vh-150px)] flex-col"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {renderInput("Nome do Lead", fieldMap["nome_do_lead"], { required: true })}
              {renderInput("Nome da Empresa", fieldMap["nome_da_empresa"])}
              <div>
                <label htmlFor={fieldMap["cpf_cnpj"]} className="mb-1 block text-sm font-medium text-foreground">
                  CPF/CNPJ
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={fieldMap["cpf_cnpj"]}
                    name={fieldMap["cpf_cnpj"]}
                    value={formData[fieldMap["cpf_cnpj"]] ?? ""}
                    onChange={handleChange}
                    className="flex-1 rounded border border-border bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const query = encodeURIComponent(`${formData[fieldMap["nome_da_empresa"]]} CNPJ`);
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
              {renderInput("Site", fieldMap["site"], { type: "url" })}
              {renderInput("Sub-Origem", fieldMap["sub_origem"])}
              {renderSelect("Mercado", fieldMap["mercado"], mercadosList, { required: true, value: formData[fieldMap["mercado"]] ?? "", onChange: handleChange })}
              {renderSelect("Produto", fieldMap["produto"], produtosList, { value: formData[fieldMap["produto"]] ?? "", onChange: handleChange })}
              {renderSelect("Email Pré-vendedor", fieldMap["email_prevendedor"], prevendedoresList, { value: formData[fieldMap["email_prevendedor"]] ?? "", onChange: handleChange })}
              {renderInput("Área", fieldMap["area"], { required: true, placeholder: "Separar múltiplas por ;" })}
              {renderInput("Telefones", fieldMap["telefones"], { required: true, placeholder: "Separar múltiplos por ;" })}
              {renderInput("Observação", fieldMap["observacao"])}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Funil{hasFunnels ? ' *' : ''}</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm text-foreground bg-card"
                  value={selectedFunnelId}
                  onChange={handleFunnelChange}
                  disabled={!hasFunnels}
                >
                  <option value="">
                    {hasFunnels ? 'Selecione o funil' : 'Funis indisponíveis'}
                  </option>
                  {funnels.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Etapa{hasStagesForFunnel ? ' *' : ''}
                </label>
                <select
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-sm text-foreground bg-card',
                    stageError ? 'border-destructive' : 'border-border'
                  )}
                  value={selectedStageName}
                  onChange={handleStageChange}
                  disabled={!selectedFunnelId || !hasStagesForFunnel}
                >
                  <option value="">
                    {!selectedFunnelId
                      ? 'Selecione o funil primeiro'
                      : hasStagesForFunnel
                        ? 'Selecione a etapa'
                        : 'Etapas indisponíveis'}
                  </option>
                  {stageList.map((stageName) => (
                    <option key={stageName} value={stageName}>{stageName}</option>
                  ))}
                </select>
                {stageError && (
                  <p className="mt-1 text-xs text-destructive">{stageError}</p>
                )}
              </div>

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Endereço</h3>
              {renderInput("País", fieldMap["pais"])}
              {renderInput("Estado", fieldMap["estado"])}
              {renderInput("Cidade", fieldMap["cidade"])}
              {renderInput("Logradouro", fieldMap["logradouro"])}
              {renderInput("Número", fieldMap["numero"])}
              {renderInput("Bairro", fieldMap["bairro"])}
              {renderInput("Complemento", fieldMap["complemento"])}
              {renderInput("CEP", fieldMap["cep"])}

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Contato</h3>
              {renderInput("Nome Contato", fieldMap["nome_contato"])}
              {renderInput("Cargo Contato", fieldMap["cargo_contato"])}
              {renderInput("E-mail Contato", fieldMap["e_mail_contato"], { type: "email" })}
              {renderInput("Telefones Contato", fieldMap["telefones_contato"], {
                placeholder: "Separar múltiplos por ;",
              })}

              <h3 className="col-span-full border-t border-border/60 pt-4 text-lg font-semibold text-foreground">Outros</h3>
              {renderInput("Tipo do Serv. Comunicação", fieldMap["tipo_do_serv_comunicacao"])}
              {renderInput("ID do Serv. Comunicação", fieldMap["id_do_serv_comunicacao"])}
            </div>
          </div>

          <DialogFooter className="w-full flex-col gap-3 border-t border-border/60 bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleEnrich}
              disabled={isEnriching || isProcessing}
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
                disabled={isProcessing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                disabled={isProcessing || isEnriching}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                aria-label="Enviar ao Spotter"
              >
                {(isProcessing) ? (
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
                <span className="font-semibold"> {formData[fieldMap["nome_da_empresa"]] || ""}</span>?
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
        <ToastContainer position="bottom-right" autoClose={4000} theme="colored" />
      </DialogContent>
    </Dialog>
  );
}
