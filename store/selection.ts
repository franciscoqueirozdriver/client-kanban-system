"use client";
import { create } from "zustand";

export const useSelection = create((set, get) => ({
  selectedIds: new Set(),
  isSelected: (id) => get().selectedIds.has(id),
  clear: () => set({ selectedIds: new Set() }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedIds: next };
    }),
  setMany: (ids, checked) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return { selectedIds: next };
    }),
}));
