'use client';
import { useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ObservationModal({ open, onConfirm, onClose }) {
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!open) {
      setObs('');
    }
  }, [open]);

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm(obs);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-lg font-semibold">Observação</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="observation-textarea">
            Descreva a interação realizada
          </label>
          <textarea
            id="observation-textarea"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            rows={5}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Inclua observações relevantes sobre o contato"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
