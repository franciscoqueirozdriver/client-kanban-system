"use client";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Lead } from "@/types/lead";
import BulkActions from "./BulkActions";

const ETAPAS = [
  "Lead Selecionado",
  "Tentativa de Contato",
  "Contato Efetuado",
  "Conversa Iniciada",
  "Reunião Agendada",
  "Enviado Spotter",
  "Perdido",
];

const PAGE_SIZE = 10;

function CurrencyInput({ value, onChange }: { value: string | number | undefined; onChange: (value: string) => void }) {
  const [local, setLocal] = useState(String(value ?? ""));

  useEffect(() => {
    setLocal(String(value ?? ""));
  }, [value]);

  return (
    <input
      className="w-28 rounded border px-2 py-1 text-right"
      value={local}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/[^\d,.-]/g, "");
        setLocal(v);
      }}
      onBlur={() => onChange?.(local)}
      placeholder="R$ 0,00"
    />
  );
}

type LeadsTableProps = {
  data?: Lead[]; // opcional, com default
  onInlinePatch?: (id: Lead["id"], partial: Partial<Lead>) => void | Promise<void>;
};

export default function LeadsTable({
  data = [] as Lead[],
  onInlinePatch,
}: LeadsTableProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<Lead["id"]>>(() => new Set<Lead["id"]>());
  const [density, setDensity] = useState(search?.get("density") || "comfortable");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [page, setPage] = useState(0);

  const isSelected = useCallback((id: Lead["id"]) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: Lead["id"]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setMany = useCallback((ids: Lead["id"][], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<Lead["id"]>());
  }, []);

  const filtered: Lead[] = useMemo(() => {
    const result = data.filter((lead) => {
      if (stage !== "all" && stage && lead.etapa !== stage) {
        return false;
      }

      if (!query) return true;

      const q = query.toLowerCase();
      const seg = (lead as any)?.segmento ?? (lead as any)?.organizacao_segmento;
      return [lead.empresa, lead.contato, lead.cidade, lead.uf, seg, lead.etapa, lead.owner, lead.fonte]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    return result;
  }, [data, query, stage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);

  const paginated = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const rowPad = density === "compact" ? "py-1" : "py-3";

  const allVisibleIds = useMemo<Lead["id"][]>(() => filtered.map((r) => r.id), [filtered]);

  const toggleAllVisible = (checked: boolean) => setMany(allVisibleIds, checked);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <input
          placeholder="Filtrar..."
          className="w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Filtrar por etapa"
          value={stage}
          onChange={(event) => {
            setStage(event.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">Todas as etapas</option>
          {ETAPAS.map((etapa) => (
            <option key={etapa} value={etapa}>
              {etapa}
            </option>
          ))}
        </select>
        <button
          className="ml-auto inline-flex items-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
        >
          Densidade: {density === "compact" ? "Compacta" : "Confortável"}
        </button>
      </div>

      <BulkActions
        selectedIds={selectedIdsArray}
        onClear={clearSelection}
        onMoveStage={async (ids) => {
          // stub: troque por chamada de API em massa
          console.log("move stage → ids", ids);
        }}
        onAssignOwner={async (ids) => console.log("assign owner →", ids)}
        onSendSpotter={async (ids) => console.log("send spotter →", ids)}
        onConsultarPerdcomp={async (ids) => console.log("per/dcomp →", ids)}
      />

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="min-h-0 overflow-auto">
          <table className="min-w-[960px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleIds.every((id) => selectedIds.has(id as Lead["id"])) && allVisibleIds.length > 0}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Cidade/UF</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Dono</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Último contato</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="w-28 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-border/70 transition hover:bg-muted/40 ${rowPad} ${
                    density === "compact" ? "text-xs" : "text-sm"
                  }`}
                >
                  <td className="px-4 align-top">
                    <input type="checkbox" checked={isSelected(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-4 align-top">
                    <button
                      className="font-semibold text-primary underline-offset-4 hover:text-primary/80 focus-visible:underline"
                      onClick={() => {
                        // abre split direto: set ?view=split&selected=id
                        const sp = new URLSearchParams(search?.toString() ?? "");
                        sp.set("view", "split");
                        sp.set("selected", String(r.id));
                        router.push(`?${sp.toString()}`, { scroll: false });
                      }}
                    >
                      {r.empresa || "-"}
                    </button>
                  </td>
                  <td className="px-4 align-top text-muted-foreground">{r.contato || "-"}</td>
                  <td className="px-4 align-top text-muted-foreground">{[r.cidade, r.uf].filter(Boolean).join(" / ") || "-"}</td>
                  <td className="px-4 align-top text-muted-foreground">{((r as any)?.segmento ?? (r as any)?.organizacao_segmento) || "-"}</td>
                  <td className="px-4 align-top">
                    <select
                      className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={r.etapa || ""}
                      onChange={async (e) => onInlinePatch?.(r.id, { etapa: e.target.value })}
                    >
                      <option value="">—</option>
                      {ETAPAS.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </td>
                  <td className="px-4 align-top">
                    <input
                      className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      defaultValue={r.owner || ""}
                      onBlur={async (e) => onInlinePatch?.(r.id, { owner: e.target.value })}
                    />
                  </td>
                  <td className="px-4 text-right align-top">
                    <CurrencyInput
                      value={r.valor}
                      onChange={async (v) => onInlinePatch?.(r.id, { valor: v })}
                    />
                  </td>
                  <td className="px-4 align-top text-muted-foreground">{r.ultimoContato || "-"}</td>
                  <td className="px-4 align-top text-muted-foreground">{r.fonte || "-"}</td>
                  <td className="px-4 align-top">
                    <div className="flex justify-end gap-2 text-xs">
                      <button className="rounded-full border border-border px-3 py-1 font-medium text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        Spotter
                      </button>
                      <button className="rounded-full border border-border px-3 py-1 font-medium text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        PER/DCOMP
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Sem resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-soft md:flex-row md:items-center md:justify-between">
        <span>
          Mostrando {paginated.length === 0 ? 0 : currentPage * PAGE_SIZE + 1} -
          {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} registros
        </span>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={currentPage === 0}
          >
            Anterior
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            Página {currentPage + 1} de {totalPages}
          </span>
          <button
            className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
            disabled={currentPage + 1 >= totalPages}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
