"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type View = "kanban" | "list" | "split";

export default function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Lê o valor salvo só quando houver window
  const ls = typeof window !== "undefined" ? localStorage.getItem("kanban_view_pref") : null;

  // Normaliza a view atual (URL > localStorage > default)
  const getCurrent = (): View => {
    const q = search?.get("view");
    if (q === "kanban" || q === "list" || q === "split") return q;
    if (ls === "kanban" || ls === "list" || ls === "split") return ls;
    return "kanban";
  };
  const current: View = getCurrent();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kanban_view_pref", current);
    }
  }, [current]);

  const setView = (v: View) => {
    const sp = new URLSearchParams(search?.toString() ?? "");
    sp.set("view", v);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const Button = ({ v, label }: { v: View; label: string }) => {
    const active = current === v;
    return (
      <button
        onClick={() => setView(v)}
        title={label}
        className={`rounded-md px-3 py-2 text-sm border transition ${
          active ? "bg-neutral-100 border-neutral-300" : "bg-white hover:bg-neutral-50 border-neutral-200"
        }`}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Button v="kanban" label="Kanban" />
      <Button v="list" label="Lista" />
      <Button v="split" label="Split" />
    </div>
  );
}
