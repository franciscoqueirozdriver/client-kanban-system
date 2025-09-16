"use client";
import { create } from "zustand";

interface SelectionState {
  selectedIds: Set<string | number>;
  isSelected: (id: string | number) => boolean;
  clear: () => void;
  toggle: (id: string | number) => void;
  setMany: (ids: (string | number)[], checked: boolean) => void;
}

export const useSelection = create<SelectionState>((set, get) => ({
  selectedIds: new Set(),
  isSelected: (id) => get().selectedIds.has(id),
  clear: () => set({ selectedIds: new Set() }),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),
  setMany: (ids, checked) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      ids.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return { selectedIds: next };
    }),
}));
