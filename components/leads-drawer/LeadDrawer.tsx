"use client";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSegmento, asArray } from "@/lib/ui/safe";

type Lead = {
  id: string | number;
  empresa?: string;
  contato?: string;
  email?: string;
  linkedin?: string;
  cidade?: string;
  uf?: string;
  segmento?: string;
  etapa?: string;
  owner?: string;
  valor?: string | number;
};

export default function LeadDrawer({ data = [] as Lead[] }) {
  const search = useSearchParams();           // pode ser null na sua tipagem
  const router = useRouter();

  // ✅ segura null em tempo de build
  const selected = search?.get("selected") ?? null;

  const lead = useMemo(
    () => asArray(data).find((x) => String(x.id) === String(selected)),
    [data, selected]
  );

  const closeDrawer = () => {
    const sp = new URLSearchParams(search?.toString() ?? "");
    sp.delete("selected");
    router.push(`?${sp.toString()}`, { scroll: false });
  };

  if (!selected) {
    return (
      <aside className="hidden lg:flex h-full items-center justify-center text-neutral-500">
        Selecione um lead na lista
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{lead?.empresa || "Lead"}</h3>
        <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer}>
          Fechar
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div><span className="font-medium">Contato:</span> {lead?.contato || "-"}</div>
        <div><span className="font-medium">E-mail:</span> {lead?.email ? <a className="underline break-words" href={`mailto:${lead.email}`}>{lead.email}</a> : "-"}</div>
        <div><span className="font-medium">LinkedIn:</span> {lead?.linkedin ? <a className="underline break-words" target="_blank" rel="noreferrer" href={lead.linkedin}>Abrir</a> : "-"}</div>
        <div><span className="font-medium">Cidade/UF:</span> {asArray([lead?.cidade, lead?.uf]).filter(Boolean).join(" / ") || "-"}</div>
        <div><span className="font-medium">Segmento:</span> {getSegmento(lead)}</div>
        <div><span className="font-medium">Etapa:</span> {lead?.etapa || "-"}</div>
        <div><span className="font-medium">Dono:</span> {lead?.owner || "-"}</div>
        <div><span className="font-medium">Valor:</span> {lead?.valor || "-"}</div>

        <div className="border-t pt-2">
          <div className="mb-2 font-medium">Ações</div>
          <div className="flex items-center gap-2">
            <button className="rounded border px-3 py-1">Enviar ao Spotter</button>
            <button className="rounded border px-3 py-1">Consultar PER/DCOMP</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
