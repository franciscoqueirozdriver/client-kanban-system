'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function MessageModal({ open, messages = [], onSelect, onClose }) {
  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-lg font-semibold">Selecione uma mensagem</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {messages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {messages.map((m, idx) => (
                <Button
                  key={idx}
                  type="button"
                  className="justify-start"
                  onClick={() => {
                    onSelect?.(m);
                    handleClose();
                  }}
                >
                  {m.titulo}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem disponível para este canal.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
