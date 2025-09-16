"use client";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import ViewToggle from "@/components/view-toggle/ViewToggle";
import LeadsTable from "@/components/leads-table/LeadsTable";
import LeadDrawer from "@/components/leads-drawer/LeadDrawer";
import type { Lead } from "@/types/lead"; // se não tiver, troque por o tipo local

// Altura do topo (header + filtros) que ficam acima do conteúdo de cada visão.
// Ajuste fino até encaixar no seu layout:
const VIEW_OFFSET_PX = 220;

/** --------------- LIST VIEW --------------- **/
function ListView({ leads }: { leads: Lead[] }) {
  // Exemplo de densidade local, filtros, etc. (opcional)
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  return (
    <section
      className="grid grid-rows-[auto_1fr] min-h-0"
      style={{ height: `calc(100vh - ${VIEW_OFFSET_PX}px)` }}
    >
      {/* Row 1 — Cabeçalho fixo (não rola) */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 className="text-lg font-semibold">Leads (Lista)</h2>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
          >
            Densidade: {density === "compact" ? "Compacta" : "Confortável"}
          </button>
          <ViewToggle />
        </div>
      </div>

      {/* Row 2 — Viewport com rolagem própria (vertical e horizontal) */}
      <div
        id="list-viewport"
        className="min-h-0 overflow-auto rounded-lg border bg-white"
      >
        {/* Wrapper da tabela com scroll H quando precisar */}
        <div className="min-h-0 overflow-x-auto">
          {/* A tabela ganha uma largura mínima para forçar scroll H quando estreito */}
          <table className="min-w-[1000px] w-full">
            {/* Você pode manter seu Thead padrão no LeadsTable.
                Aqui vai só um invólucro, mas para simplificar vamos delegar ao componente: */}
          </table>

          {/* Render real da tabela (com seleção/edição) */}
          <LeadsTable
            data={leads}
            onInlinePatch={async () => {}}
          />
        </div>
      </div>
    </section>
  );
}

/** --------------- SPLIT VIEW --------------- **/
function SplitView({ leads }: { leads: Lead[] }) {
  const search = useSearchParams();
  const selected = search?.get("selected") ?? null;

  return (
    <section
      className="grid grid-rows-[auto_1fr] min-h-0"
      style={{ height: `calc(100vh - ${VIEW_OFFSET_PX}px)` }}
    >
      {/* Row 1 — Cabeçalho fixo */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 className="text-lg font-semibold">Leads (Split)</h2>
        <ViewToggle />
      </div>

      {/* Row 2 — Grade com dois painéis, cada um com sua própria rolagem */}
      <div
        className="
          grid min-h-0 gap-4
          grid-cols-1
          lg:grid-cols-[minmax(520px,1fr)_minmax(380px,420px)]
        "
      >
        {/* Painel esquerdo: Lista com viewport próprio */}
        <div
          className="min-h-0 rounded-lg border bg-white grid grid-rows-[auto_1fr]"
        >
          {/* Controles da lista (fixos dentro do painel esquerdo) */}
          <div className="p-3 border-b">
            {/* Filtros/ações rápidas aqui, se quiser */}
          </div>

          {/* Viewport do painel esquerdo (só este rola) */}
          <div className="min-h-0 overflow-auto p-3">
            <div className="min-h-0 overflow-x-auto">
              {/* mesma ideia: largura mínima para forçar H-scroll local quando preciso */}
              <div className="min-w-[1000px]">
                <LeadsTable
                  data={leads}
                  onInlinePatch={async () => {}}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Painel direito: Drawer/Detalhe com rolagem própria */}
        <aside className="min-h-0 overflow-auto rounded-lg border bg-white p-3">
          <LeadDrawer data={leads} />
          {/* O LeadDrawer já lida com "selected" via URL; se não houver, mostra placeholder */}
        </aside>
      </div>
    </section>
  );
}

/** --------------- SWITCH --------------- **/
export default function Views({ leads = [] as Lead[] }) {
  const search = useSearchParams();
  const view = (search?.get("view") ?? "kanban") as "kanban" | "list" | "split";

  if (view === "list") return <ListView leads={leads} />;
  if (view === "split") return <SplitView leads={leads} />;

  // NADA muda no Kanban: simplesmente não renderizamos nada aqui
  return null;
}
