'use client';

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaSpinner } from "react-icons/fa";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { validateSpotterLead } from "../../validators/spotterLead";

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

const validatorFieldToFormKey = {
  nomeLead: fieldMap["Nome do Lead"],
  origem: fieldMap["Origem"],
  mercado: fieldMap["Mercado"],
  pais: fieldMap["País"],
  estado: fieldMap["Estado"],
  cidade: fieldMap["Cidade"],
  telefones: fieldMap["Telefones"],
  nomeContato: fieldMap["Nome Contato"],
  telefonesContato: fieldMap["Telefones Contato"],
  emailContato: fieldMap["E-mail Contato"],
  tipoServCom: fieldMap["Tipo do Serv. Comunicação"],
  idServCom: fieldMap["ID do Serv. Comunicação"],
  area: fieldMap["Área"],
  funilId: fieldMap["Funil"],
  etapaNome: fieldMap["Etapa"],
  address: fieldMap["Logradouro"],
  addressNumber: fieldMap["Número"],
  addressComplement: fieldMap["Complemento"],
  neighborhood: fieldMap["Bairro"],
  zipcode: fieldMap["CEP"],
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
  const [isLoadingFunnels, setIsLoadingFunnels] = useState(false);
  const [stagesByFunnel, setStagesByFunnel] = useState({});
  const [spotterOnline, setSpotterOnline] = useState(true);
  const [prefillFunnelName, setPrefillFunnelName] = useState("");
  const [prefillStageName, setPrefillStageName] = useState("");
  const isProcessing = isSubmitting || isSubmittingLocal;
  const funilKey = fieldMap["Funil"];
  const etapaKey = fieldMap["Etapa"];

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
        [fieldMap["Etapa"]]: "",
        [fieldMap["Funil"]]: "",
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
      setFormErrors({});
      setPrefillFunnelName("Pré-venda");
      setPrefillStageName("Entrada");
      setStagesByFunnel({});
    };

    fetchAndPrefill();
  }, [open, lead]);

  useEffect(() => {
    if (!open) {
      setFormErrors({});
      setFunnels([]);
      setStagesByFunnel({});
      setPrefillFunnelName("");
      setPrefillStageName("");
      setSpotterOnline(true);
    }
  }, [open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === funilKey) {
      setPrefillStageName("");
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        [etapaKey]: "",
      }));
      return;
    }

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

  const valueOrNull = (label) => {
    const value = readTrimmedValue(label);
    return value ? value : null;
  };

  const valueOrUndefined = (label) => {
    const value = readTrimmedValue(label);
    return value ? value : undefined;
  };

  const mapFieldErrorsToForm = (fieldErrors) => {
    if (!fieldErrors || typeof fieldErrors !== "object") {
      return {};
    }
    const mapped = {};
    Object.entries(fieldErrors).forEach(([field, messages]) => {
      const formKey = validatorFieldToFormKey[field] || field;
      if (!formKey) return;
      const message = Array.isArray(messages) ? messages[0] : messages;
      if (message) {
        mapped[formKey] = String(message);
      }
    });
    return mapped;
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadSpotterData = async () => {
      setIsLoadingFunnels(true);
      try {
        const [stagesRes, funnelsRes] = await Promise.all([
          fetch("/api/spotter/stages", { cache: "no-store" }),
          fetch("/api/spotter/funnels", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (!stagesRes.ok) {
          const text = await stagesRes.text().catch(() => "");
          throw new Error(text || "Falha ao buscar etapas do Spotter.");
        }

        const stagesJson = await stagesRes.json().catch(() => []);
        const stageItems = Array.isArray(stagesJson) ? stagesJson : [];

        const groupedStages = stageItems.reduce((acc, rawStage) => {
          const funnelId = rawStage?.funnelId ? String(rawStage.funnelId) : "";
          const name = rawStage?.name != null ? String(rawStage.name).trim() : "";
          if (!funnelId || !name) return acc;
          const rawPosition =
            rawStage?.position ?? rawStage?.Position ?? rawStage?.posicao ?? rawStage?.Posicao ?? 0;
          const numericPosition = Number(rawPosition);
          const stageEntry = {
            id: rawStage?.id != null ? String(rawStage.id) : undefined,
            nome: name,
            position: Number.isFinite(numericPosition) ? numericPosition : 0,
          };
          if (!acc[funnelId]) {
            acc[funnelId] = [];
          }
          acc[funnelId].push(stageEntry);
          return acc;
        }, {});

        Object.keys(groupedStages).forEach((key) => {
          groupedStages[key] = groupedStages[key]
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((stage) => ({ id: stage.id, nome: stage.nome }));
        });

        let normalizedFunnels = [];
        if (funnelsRes.ok) {
          const funnelsJson = await funnelsRes.json().catch(() => []);
          normalizedFunnels = (Array.isArray(funnelsJson) ? funnelsJson : [])
            .map((item) => ({
              id: item?.id != null ? String(item.id) : "",
              name:
                item?.name != null
                  ? String(item.name)
                  : item?.value != null
                  ? String(item.value)
                  : item?.label != null
                  ? String(item.label)
                  : "",
            }))
            .map((item) => ({
              id: item.id,
              name: typeof item.name === "string" ? item.name.trim() : "",
            }))
            .filter((item) => item.id && item.name);
        }

        if (!normalizedFunnels.length) {
          const ids = Array.from(
            new Set(
              stageItems
                .map((stage) => (stage?.funnelId != null ? String(stage.funnelId) : ""))
                .filter(Boolean),
            ),
          );
          normalizedFunnels = ids.map((id) => ({ id, name: `Funil #${id}` }));
        }

        if (cancelled) return;

        setStagesByFunnel(groupedStages);
        setFunnels(normalizedFunnels);
        setSpotterOnline(true);
      } catch (error) {
        console.error("Falha ao carregar dados do Spotter", error);
        if (!cancelled) {
          setSpotterOnline(false);
          setFunnels([]);
          setStagesByFunnel({});
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFunnels(false);
        }
      }
    };

    loadSpotterData();

    return () => {
      cancelled = true;
    };
  }, [open, funilKey, etapaKey, setFormData]);

  const selectedFunnelId = formData[funilKey] ?? "";

  const filteredStages = useMemo(() => {
    const list = stagesByFunnel[selectedFunnelId];
    return Array.isArray(list) ? list : [];
  }, [selectedFunnelId, stagesByFunnel]);

  useEffect(() => {
    if (!open) return;
    if (!funnels.length) return;

    let applied = false;
    setFormData((prev) => {
      const currentValue = prev[funilKey];
      if (currentValue) return prev;

      const matcher = (value) =>
        value?.toLowerCase?.() === prefillFunnelName?.toLowerCase?.();

      const desired = prefillFunnelName
        ? funnels.find((item) => matcher(item?.name))
        : null;
      const fallback = desired || funnels[0];
      if (!fallback?.id && !fallback?.name) {
        return prev;
      }
      applied = true;
      return {
        ...prev,
        [funilKey]: String(fallback.id ?? fallback.name ?? ""),
      };
    });

    if (applied && prefillFunnelName) {
      setPrefillFunnelName("");
    }
  }, [funnels, open, funilKey, prefillFunnelName]);


  useEffect(() => {
    if (!open) return;
    if (!selectedFunnelId) return;

    const stages = stagesByFunnel[selectedFunnelId];
    if (!Array.isArray(stages) || stages.length === 0) return;

    let applied = false;
    setFormData((prev) => {
      const currentStage = prev[etapaKey];
      const hasCurrent =
        typeof currentStage === "string" &&
        stages.some((stage) => stage?.nome && stage.nome.toLowerCase() === currentStage.toLowerCase());
      if (hasCurrent) return prev;

      const desired =
        prefillStageName && typeof prefillStageName === "string"
          ? stages.find((stage) => stage?.nome && stage.nome.toLowerCase() === prefillStageName.toLowerCase())
          : null;
      const fallback = desired || stages[0];
      if (!fallback?.nome) return prev;
      applied = true;
      return {
        ...prev,
        [etapaKey]: fallback.nome,
      };
    });

    if (applied && prefillStageName) {
      setPrefillStageName("");
    }
  }, [open, selectedFunnelId, stagesByFunnel, etapaKey, prefillStageName]);

  const validatorStagesMap = useMemo(() => {
    const entries = Object.entries(stagesByFunnel || {});
    if (!entries.length) return undefined;
    const mapped = {};
    entries.forEach(([id, list]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      const normalized = list
        .map((stage) => ({
          id: stage?.id ?? stage?.ID ?? stage?.value ?? stage?.name ?? stage?.nome ?? "",
          nome: stage?.nome ?? stage?.name ?? stage?.value ?? "",
        }))
        .filter((stage) => stage.nome);
      if (normalized.length) {
        mapped[String(id)] = normalized;
      }
    });
    return Object.keys(mapped).length ? mapped : undefined;
  }, [stagesByFunnel]);

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
    setFormErrors({});

    const validatorPayload = {
      nomeLead: readTrimmedValue("Nome do Lead"),
      origem: readTrimmedValue("Origem"),
      mercado: readTrimmedValue("Mercado"),
      pais: readTrimmedValue("País"),
      estado: readTrimmedValue("Estado"),
      cidade: readTrimmedValue("Cidade"),
      telefones: readValue("Telefones"),
      nomeContato: readTrimmedValue("Nome Contato"),
      telefonesContato: readValue("Telefones Contato"),
      emailContato: readTrimmedValue("E-mail Contato"),
      tipoServCom: readTrimmedValue("Tipo do Serv. Comunicação"),
      idServCom: readTrimmedValue("ID do Serv. Comunicação"),
      area: readValue("Área"),
      modalidade: formData.modalidade ?? "",
      funilId: valueOrNull("Funil"),
      etapaNome: valueOrNull("Etapa"),
      address: readTrimmedValue("Logradouro"),
      addressNumber: readTrimmedValue("Número"),
      addressComplement: readTrimmedValue("Complemento"),
      neighborhood: readTrimmedValue("Bairro"),
      zipcode: readTrimmedValue("CEP"),
    };

    const requiresStageSelection =
      spotterOnline && selectedFunnelId && filteredStages.length > 0;

    if (requiresStageSelection && !validatorPayload.etapaNome) {
      setFormErrors({ [etapaKey]: "Selecione uma etapa do funil." });
      alert("Selecione uma etapa do funil.");
      return;
    }

    const clientValidation = validateSpotterLead(validatorPayload, {
      etapasPorFunil: validatorStagesMap,
    });

    if (!clientValidation.ok) {
      const mappedErrors = mapFieldErrorsToForm(clientValidation.fieldErrors);
      if (Object.keys(mappedErrors).length > 0) {
        setFormErrors(mappedErrors);
      }
      if (clientValidation.messages.length) {
        console.warn("Validação Spotter (cliente):", clientValidation.messages.join(" | "));
      }
      alert("Preencha os campos obrigatórios.");
      return;
    }

    if (clientValidation.messages.length) {
      console.warn("Validação Spotter (cliente):", clientValidation.messages.join(" | "));
    }

    const payloadForServer = {
      ...validatorPayload,
      subSource: valueOrUndefined("Sub-Origem"),
      subOrigem: valueOrUndefined("Sub-Origem"),
      leadProduct: valueOrUndefined("Produto"),
      produto: valueOrUndefined("Produto"),
      website: valueOrUndefined("Site"),
      site: valueOrUndefined("Site"),
      cpfcnpj: valueOrUndefined("CPF/CNPJ"),
      observacao: valueOrUndefined("Observação"),
      description: valueOrUndefined("Observação"),
      emailPrevendedor: valueOrUndefined("Email Pré-vendedor"),
      nomeEmpresa: valueOrUndefined("Nome da Empresa"),
      cargoContato: valueOrUndefined("Cargo Contato"),
      ddiContato: valueOrUndefined("DDI Contato"),
      logradouro: valueOrUndefined("Logradouro"),
      numero: valueOrUndefined("Número"),
      complemento: valueOrUndefined("Complemento"),
      bairro: valueOrUndefined("Bairro"),
      cep: valueOrUndefined("CEP"),
      tipoServComunicacao: validatorPayload.tipoServCom,
      idServComunicacao: validatorPayload.idServCom,
      stageId:
        filteredStages.find(
          (stage) =>
            stage?.nome &&
            validatorPayload.etapaNome &&
            stage.nome.toLowerCase() === validatorPayload.etapaNome.toLowerCase(),
        )?.id ?? undefined,
    };

    setIsSubmittingLocal(true);

    try {
      if (!onSubmit) {
        throw new Error("Função de envio ao Spotter não definida.");
      }

      const response = await onSubmit(payloadForServer);
      const serverMessages = Array.isArray(response?.messages) ? response.messages : [];
      const combinedMessages = [...clientValidation.messages, ...serverMessages];
      const successMessage =
        combinedMessages.length > 0
          ? `Enviado ao Spotter com sucesso. — ${combinedMessages.join(' • ')}`
          : "Enviado ao Spotter com sucesso.";
      alert(successMessage);
      setFormErrors({});
      onOpenChange?.(false);
    } catch (error) {
      console.error("Erro no envio ao Spotter:", error);
      const fieldErrors = error?.fieldErrors || error?.details;
      const mappedErrors = mapFieldErrorsToForm(fieldErrors);
      if (Object.keys(mappedErrors).length > 0) {
        setFormErrors(mappedErrors);
      }
      const extraMessages = Array.isArray(error?.messages) ? error.messages : [];
      const messageParts = [error?.error || error?.message || "Falha ao enviar ao Spotter."];
      if (extraMessages.length) {
        messageParts.push(extraMessages.join(" • "));
      }
      alert(messageParts.filter(Boolean).join(" — "));
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const renderInput = (label, key, props = {}) => {
    const errorMessage = formErrors?.[key];
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
            errorMessage ? "border-red-500" : "border-border",
            props.className,
          )}
          aria-invalid={Boolean(errorMessage)}
        />
        {errorMessage && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
      </div>
    );
  };

  const renderSelect = (label, key, options, props = {}) => {
    const errorMessage = formErrors?.[key];
    const { placeholder, className, ...selectProps } = props;
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
          {props.required ? " *" : ""}
        </label>
        <select
          id={key}
          name={key}
          value={formData[key] ?? ""}
          onChange={handleChange}
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
              {renderSelect(
                "Funil",
                funilKey,
                funnels.map((funnel) => ({ value: funnel.id, label: funnel.name })),
                {
                  required: spotterOnline && funnels.length > 0,
                  placeholder: spotterOnline
                    ? isLoadingFunnels
                      ? "Carregando funis..."
                      : "Selecione..."
                    : "Indisponível (servidor valida)",
                  disabled: !spotterOnline || (isLoadingFunnels && funnels.length === 0),
                },
              )}
              {renderSelect(
                "Etapa",
                etapaKey,
                filteredStages.map((stage) => ({ value: stage.nome, label: stage.nome })),
                {
                  required: spotterOnline && Boolean(selectedFunnelId) && filteredStages.length > 0,
                  placeholder: !spotterOnline
                    ? "Indisponível (servidor valida)"
                    : !selectedFunnelId
                    ? "Escolha um funil"
                    : filteredStages.length
                    ? "Selecione..."
                    : isLoadingFunnels
                    ? "Carregando etapas..."
                    : "Sem etapas",
                  disabled: !spotterOnline || !selectedFunnelId || filteredStages.length === 0,
                },
              )}
              {!spotterOnline && (
                <p className="col-span-full text-xs text-muted-foreground">
                  Não foi possível listar funis/etapas agora. O servidor validará a etapa no envio.
                </p>
              )}

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
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                disabled={isProcessing || isEnriching}
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
