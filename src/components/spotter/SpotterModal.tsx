'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Values = Record<string, any>;

type SpotterModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: (payload: Values) => Promise<void>;
  defaults?: Values;
};

export default function SpotterModal({ open, onOpenChange, onSubmit, defaults = {} }: SpotterModalProps) {
  const [values, setValues] = useState<Values>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setValues(defaults || {});
  }, [open, defaults]);

  const required = useMemo(() => ['leadName', 'company', 'market', 'area'], []);
  const update = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      for (const k of required) {
        const val = values[k];
        if (!val || String(val).trim() === '') {
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
          const res = await fetch('/api/spotter/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Falha ao enviar ao Spotter.');
        }
        onOpenChange(false);
      } catch (err: any) {
        alert(err?.message || 'Não foi possível enviar agora.');
      } finally {
        setSending(false);
      }
    },
    [values, onSubmit, onOpenChange, required],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Enviar ao Spotter</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome do Lead *</label>
            <Input value={values.leadName ?? ''} onChange={(e) => update('leadName', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Empresa *</label>
            <Input value={values.company ?? ''} onChange={(e) => update('company', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">CPF/CNPJ</label>
            <Input value={values.taxId ?? ''} onChange={(e) => update('taxId', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Mercado *</label>
            <Input value={values.market ?? ''} onChange={(e) => update('market', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Área *</label>
            <Input value={values.area ?? ''} onChange={(e) => update('area', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail Contato</label>
            <Input type="email" value={values.contactEmail ?? ''} onChange={(e) => update('contactEmail', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Telefone Contato</label>
            <Input value={values.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Observações</label>
            <Textarea value={values.notes ?? ''} onChange={(e) => update('notes', e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancelar
            </Button>
            <Button type="submit" aria-label="Enviar ao Spotter" disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar ao Spotter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
