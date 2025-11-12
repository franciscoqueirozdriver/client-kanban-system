'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface Interaction {
  id: string;
  date: string;
  type: string;
  description?: string;
  dataHora?: string;
  tipo?: string;
  mensagemUsada?: string;
  observacao?: string;
  deFase?: string;
  paraFase?: string;
  [key: string]: unknown;
}

interface HistoryModalProps {
  open: boolean;
  interactions: Interaction[];
  onClose: () => void;
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');

  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

export default function HistoryModal({ open, interactions = [], onClose }: HistoryModalProps) {
  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-lg font-semibold">Histórico de Interações</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {interactions.length > 0 ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2 text-sm">
              {interactions.map((interaction, idx) => (
                <article
                  key={`${interaction.dataHora ?? interaction.date ?? idx}`}
                  className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3"
                >
                  <header className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                    <span>{formatDate(interaction.date ?? interaction.dataHora)}</span>
                    <span className="font-medium text-foreground">{interaction.type ?? interaction.tipo}</span>
                  </header>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {interaction.tipo === 'Mudança de Fase' && interaction.deFase && interaction.paraFase && (
                      <p>
                        {interaction.deFase} → {interaction.paraFase}
                      </p>
                    )}
                    {interaction.mensagemUsada && (
                      <p>
                        <span className="font-semibold text-foreground">Mensagem:</span> {interaction.mensagemUsada}
                      </p>
                    )}
                    {interaction.observacao && (
                      <p>
                        <span className="font-semibold text-foreground">Observação:</span> {interaction.observacao}
                      </p>
                    )}
                    {interaction.description && (
                      <p>
                        <span className="font-semibold text-foreground">Descrição:</span> {interaction.description}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma interação registrada para este cliente.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
