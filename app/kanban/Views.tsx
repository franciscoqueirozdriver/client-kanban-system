"use client";
import { useSearchParams } from "next/navigation";
import ViewToggle from "@/components/view-toggle/ViewToggle";
import LeadsTable from "@/components/leads-table/LeadsTable";
import LeadDrawer from "@/components/leads-drawer/LeadDrawer";
// import { useLeads } from "@/lib/useLeads"; // se quiser via API

export default function Views({ leads = [] }) {
  const search = useSearchParams();
  const view = search?.get("view") || "kanban";

  if (view === "list") {
    return (
      <section className="space-y-3">
        <LeadsTable
          data={leads}
          onInlinePatch={async (id, partial) => {
            // TODO: chame sua API de update. Exemplo:
            // await fetch(`/api/leads/${id}`, { method:'PATCH', body: JSON.stringify(partial)});
            console.log("patch", id, partial);
          }}
        />
      </section>
    );
  }

  if (view === "split") {
    return (
      <section className="space-y-3">
        {/* layout: tabela à esquerda + drawer à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(520px,1fr)_minmax(380px,420px)] gap-4 h-[calc(100vh-260px)]">
          <div className="min-h-0 overflow-hidden rounded-lg border bg-white p-3">
            <LeadsTable
              data={leads}
              onInlinePatch={async (id, partial) => console.log("patch", id, partial)}
            />
          </div>
          <div className="min-h-0">
            <LeadDrawer data={leads} />
          </div>
        </div>
      </section>
    );
  }

  // default → não mexe no seu Kanban atual
  return null;
}
