"use client";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LeadDrawer({ data = [] }) {
  const search = useSearchParams();
  const router = useRouter();
  const selected = search.get("selected");
  const lead = useMemo(() => data.find((x) => String(x.id) === String(selected)), [data, selected]);

  if (!selected) return (
    <aside className="hidden lg:flex h-full items-center justify-center text-neutral-500">
      Selecione um lead na lista
    </aside>
  );

  return (
    <aside className="h-full overflow-y-auto rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{lead?.empresa || "Lead"}</h3>
        <button
          className="rounded border px-2 py-1 text-sm"
          onClick={() => {
            const sp = new URLSearchParams(search.toString());
            sp.delete("selected");
            router.push(`?${sp.toString()}`, { scroll: false });
          }}
        >
          Fechar
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div><span className="font-medium">Contato:</span> {lead?.contato || "-"}</div>
        <div><span className="font-medium">E-mail:</span> {lead?.email ? <a className="underline break-words" href={`mailto:${lead.email}`}>{lead.email}</a> : "-"}</div>
        <div><span className="font-medium">LinkedIn:</span> {lead?.linkedin ? <a className="underline break-words" target="_blank" rel="noreferrer" href={lead.linkedin}>Abrir</a> : "-"}</div>
        <div><span className="font-medium">Cidade/UF:</span> {[lead?.cidade, lead?.uf].filter(Boolean).join(" / ") || "-"}</div>
        <div><span className="font-medium">Segmento:</span> {lead?.segmento || "-"}</div>
        <div><span className="font-medium">Etapa:</span> {lead?.etapa || "-"}</div>
        <div><span className="font-medium">Dono:</span> {lead?.owner || "-"}</div>
        <div><span className="font-medium">Valor:</span> {lead?.valor || "-"}</div>
        <div className="pt-2 border-t">
          <div className="font-medium mb-2">Ações</div>
          <div className="flex items-center gap-2">
            <button className="rounded border px-3 py-1">Enviar ao Spotter</button>
            <button className="rounded border px-3 py-1">Consultar PER/DCOMP</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
