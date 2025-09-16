"use client";
import { useSelection } from "@/store/selection";

export default function BulkActions({ onMoveStage, onAssignOwner, onSendSpotter, onConsultarPerdcomp }) {
  const { selectedIds, clear } = useSelection();
  const count = selectedIds.size;
  if (!count) return null;

  const btnClass = "px-2.5 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50";

  return (
    <div className="sticky top-[64px] z-20 mb-3 rounded-lg border bg-white p-2 flex items-center gap-2 text-sm">
      <span className="px-2 py-1 rounded bg-neutral-100 border">{count} selecionado(s)</span>
      <button className={btnClass} onClick={() => onMoveStage(Array.from(selectedIds))}>Mover etapa</button>
      <button className={btnClass} onClick={() => onAssignOwner(Array.from(selectedIds))}>Atribuir dono</button>
      <button className={btnClass} onClick={() => onSendSpotter(Array.from(selectedIds))}>Enviar Spotter</button>
      <button className={btnClass} onClick={() => onConsultarPerdcomp(Array.from(selectedIds))}>Consultar PER/DCOMP</button>
      <div className="ml-auto" />
      <button className="text-neutral-600 hover:underline" onClick={clear}>Limpar seleção</button>
    </div>
  );
}
