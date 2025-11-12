"use client";

type BulkActionsProps = {
  selectedIds: (string | number)[];
  onClear: () => void;
  onMoveStage: (ids: (string | number)[]) => void | Promise<void>;
  onAssignOwner: (ids: (string | number)[]) => void | Promise<void>;
  onSendSpotter: (ids: (string | number)[]) => void | Promise<void>;
  onConsultarPerdcomp: (ids: (string | number)[]) => void | Promise<void>;
};

export default function BulkActions({
  selectedIds,
  onClear,
  onMoveStage,
  onAssignOwner,
  onSendSpotter,
  onConsultarPerdcomp,
}: BulkActionsProps) {
  const count = selectedIds.length;
  if (count === 0) return null;

  const btnClass =
    'inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="sticky top-[120px] z-20 mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-border bg-card/95 p-3 text-sm shadow-soft backdrop-blur">
      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {count} selecionado(s)
      </span>
      <button className={btnClass} onClick={() => onMoveStage(selectedIds)}>
        Mover etapa
      </button>
      <button className={btnClass} onClick={() => onAssignOwner(selectedIds)}>
        Atribuir dono
      </button>
      <button className={btnClass} onClick={() => onSendSpotter(selectedIds)}>
        Enviar Spotter
      </button>
      <button className={btnClass} onClick={() => onConsultarPerdcomp(selectedIds)}>
        Consultar PER/DCOMP
      </button>
      <div className="ml-auto" />
      <button
        className="text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:underline"
        onClick={onClear}
      >
        Limpar seleção
      </button>
    </div>
  );
}
