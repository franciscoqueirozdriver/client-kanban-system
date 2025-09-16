"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelection } from "@/store/selection";
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

function CurrencyInput({ value, onChange }) {
  const [local, setLocal] = useState(value ?? "");
  return (
    <input
      className="w-28 rounded border px-2 py-1 text-right"
      value={local}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d,.-]/g, "");
        setLocal(v);
      }}
      onBlur={() => onChange?.(local)}
      placeholder="R$ 0,00"
    />
  );
}

export type Lead = {
  id: string | number;
  empresa?: string;
  contato?: string;
  cidade?: string;
  uf?: string;
  segmento?: string;
  etapa?: string;
  owner?: string;
  valor?: string | number;
  ultimoContato?: string;
  fonte?: string;
  email?: string;
  linkedin?: string;
};

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
  const { selectedIds, isSelected, toggle, setMany } = useSelection();
  const [density, setDensity] = useState(search?.get("density") || "comfortable");
  const [query, setQuery] = useState("");

  const filtered: Lead[] = useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter((r) =>
      [r.empresa, r.contato, r.cidade, r.uf, r.segmento, r.etapa, r.owner, r.fonte]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data, query]);

  const rowPad = density === "compact" ? "py-1" : "py-3";

  const allVisibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

  const toggleAllVisible = (checked) => setMany(allVisibleIds, checked);

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <input
          placeholder="Filtrar..."
          className="w-64 rounded border px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ml-auto" />
        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
        >
          Densidade: {density === "compact" ? "Compacta" : "Confortável"}
        </button>
      </div>

      <BulkActions
        onMoveStage={async (ids) => {
          // stub: troque por chamada de API em massa
          console.log("move stage → ids", ids);
        }}
        onAssignOwner={async (ids) => console.log("assign owner →", ids)}
        onSendSpotter={async (ids) => console.log("send spotter →", ids)}
        onConsultarPerdcomp={async (ids) => console.log("per/dcomp →", ids)}
      />

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="min-w-[900px] w-full">
          <thead className="bg-neutral-50">
            <tr className="text-left text-sm">
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleIds.every((id) => selectedIds.has(id)) && allVisibleIds.length > 0}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Cidade/UF</th>
              <th className="px-3 py-2">Segmento</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Dono</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2">Último contato</th>
              <th className="px-3 py-2">Fonte</th>
              <th className="px-3 py-2 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t text-sm hover:bg-neutral-50 ${rowPad}`}>
                <td className="px-3">
                  <input type="checkbox" checked={isSelected(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="px-3">
                  <button
                    className="underline"
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
                <td className="px-3">{r.contato || "-"}</td>
                <td className="px-3">{[r.cidade, r.uf].filter(Boolean).join(" / ") || "-"}</td>
                <td className="px-3">{r.segmento || "-"}</td>
                <td className="px-3">
                  <select
                    className="rounded border px-2 py-1 bg-white"
                    value={r.etapa || ""}
                    onChange={async (e) => onInlinePatch?.(r.id, { etapa: e.target.value })}
                  >
                    <option value="">—</option>
                    {ETAPAS.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3">
                  <input
                    className="w-40 rounded border px-2 py-1"
                    defaultValue={r.owner || ""}
                    onBlur={async (e) => onInlinePatch?.(r.id, { owner: e.target.value })}
                  />
                </td>
                <td className="px-3 text-right">
                  <CurrencyInput
                    value={r.valor}
                    onChange={async (v) => onInlinePatch?.(r.id, { valor: v })}
                  />
                </td>
                <td className="px-3">{r.ultimoContato || "-"}</td>
                <td className="px-3">{r.fonte || "-"}</td>
                <td className="px-3">
                  <div className="flex items-center gap-2">
                    <button className="rounded border px-2 py-1 text-xs">Spotter</button>
                    <button className="rounded border px-2 py-1 text-xs">PER/DCOMP</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-neutral-500">Sem resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
