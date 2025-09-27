"use client";

import { useEffect } from "react";
import type { KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

type ViewOption = {
  value: "kanban" | "list" | "split";
  label: string;
};

type ViewToggleProps = {
  value?: ViewOption["value"];
  onValueChange?: (value: ViewOption["value"]) => void;
  options?: ViewOption[];
};

const DEFAULT_OPTIONS: ViewOption[] = [
  { value: "kanban", label: "Kanban" },
  { value: "list", label: "Lista" },
  { value: "split", label: "Split" },
];

export default function ViewToggle({
  value,
  onValueChange,
  options = DEFAULT_OPTIONS,
}: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const stored =
    typeof window !== "undefined" ? localStorage.getItem("kanban_view_pref") : null;
  const isControlled = typeof value !== "undefined" && typeof onValueChange === "function";
  const current = (isControlled ? value : search?.get("view") || stored || "kanban") as ViewOption["value"];

  useEffect(() => {
    if (!isControlled && typeof window !== "undefined") {
      localStorage.setItem("kanban_view_pref", current);
    }
  }, [current, isControlled]);

  const setView = (next: ViewOption["value"]) => {
    if (isControlled) {
      onValueChange?.(next);
      return;
    }

    const sp = new URLSearchParams(search?.toString() ?? "");
    sp.set("view", next);
    if (typeof window !== "undefined") {
      localStorage.setItem("kanban_view_pref", next);
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    next: ViewOption["value"]
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setView(next);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Alternar visualização"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1"
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            onClick={() => setView(option.value)}
            onKeyDown={(event) => handleKeyDown(event, option.value)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-card",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
