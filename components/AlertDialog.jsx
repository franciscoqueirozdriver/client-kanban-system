'use client';

export default function AlertDialog({
  isOpen,
  onClose,
  title,
  description,
  buttonText = 'OK',
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" aria-labelledby="alert-dialog-title" role="dialog" aria-modal="true">
      <div className="w-11/12 max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h2 id="alert-dialog-title" className="text-lg font-semibold text-center text-foreground">{title}</h2>
        {description && (
          <p className="mt-3 text-sm text-center text-muted-foreground">{description}</p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}