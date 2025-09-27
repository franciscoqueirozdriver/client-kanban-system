'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SpotterModal({ open, onOpenChange, onSubmit, defaults = {} }) {
  const [values, setValues] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(defaults || {});
    }
  }, [open, defaults]);

  const required = useMemo(() => ['leadName', 'company', 'market', 'area'], []);

  const update = (key, value) => {
    setValues((state) => ({ ...state, [key]: value }));
  };

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();

      for (const key of required) {
        const value = values[key];
        if (!value || String(value).trim() === '') {
          alert('Preencha os campos obrigatórios.');
          return;
        }
      }

      if (!values.contactEmail && !values.phone) {
        alert('Informe e-mail ou telefone do contato.');
        return;
      }

      setSending(true);
      try {
        if (onSubmit) {
          await onSubmit(values);
        } else {
          const response = await fetch('/api/spotter/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || 'Falha ao enviar ao Spotter.');
          }
        }
        onOpenChange(false);
      } catch (error) {
        alert(error?.message || 'Não foi possível enviar agora.');
      } finally {
        setSending(false);
      }
    },
    [required, values, onSubmit, onOpenChange],
  );

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Enviar ao Spotter</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome do Lead *</label>
            <input
              className={inputClass}
              value={values.leadName ?? ''}
              onChange={(event) => update('leadName', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Empresa *</label>
            <input
              className={inputClass}
              value={values.company ?? ''}
              onChange={(event) => update('company', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">CPF/CNPJ</label>
            <input
              className={inputClass}
              value={values.taxId ?? ''}
              onChange={(event) => update('taxId', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Mercado *</label>
            <input
              className={inputClass}
              value={values.market ?? ''}
              onChange={(event) => update('market', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Área *</label>
            <input
              className={inputClass}
              value={values.area ?? ''}
              onChange={(event) => update('area', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail Contato</label>
            <input
              type="email"
              className={inputClass}
              value={values.contactEmail ?? ''}
              onChange={(event) => update('contactEmail', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Telefone</label>
            <input
              className={inputClass}
              value={values.phone ?? ''}
              onChange={(event) => update('phone', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Cidade</label>
            <input
              className={inputClass}
              value={values.city ?? ''}
              onChange={(event) => update('city', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">UF</label>
            <input className={inputClass} value={values.uf ?? ''} onChange={(event) => update('uf', event.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Observações</label>
            <textarea
              className={`${inputClass} min-h-[84px]`}
              value={values.notes ?? ''}
              onChange={(event) => update('notes', event.target.value)}
            />
          </div>

          <DialogFooter className="md:col-span-2 mt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              disabled={sending}
            >
              {sending ? 'Enviando…' : 'Enviar ao Spotter'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
