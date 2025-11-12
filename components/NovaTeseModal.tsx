'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

type NovaTeseModalProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export default function NovaTeseModal({ onSuccess, onClose }: NovaTeseModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'TESES DE HABILITAÇÃO - PIS E COFINS',
    tema: '',
    tributo: 'PIS e COFINS',
    baseLegal: '',
    contexto: '',
    documentacao: '',
    informacoes: '',
    formaUtilizacao: '',
    publicoAlvo: '',
    grauRisco: 'Remoto'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tema.trim()) {
      alert('O tema é obrigatório');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/teses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          teseData: formData
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Tese criada com sucesso! ID: ${result.teseId}`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(`Erro ao criar tese: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao criar tese:', error);
      alert('Erro ao criar tese. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Cadastrar Nova Tese</DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna Esquerda */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Input
                id="tipo"
                value={formData.tipo}
                onChange={(e) => handleInputChange('tipo', e.target.value)}
                placeholder="Tipo da tese"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tema">Tema *</Label>
              <Input
                id="tema"
                value={formData.tema}
                onChange={(e) => handleInputChange('tema', e.target.value)}
                placeholder="Ex: AQUISIÇÕES DE BENFEITORIAS"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="tributo">Tributo do Crédito</Label>
              <select
                id="tributo"
                value={formData.tributo}
                onChange={(e) => handleInputChange('tributo', e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="PIS e COFINS">PIS e COFINS</option>
                <option value="PIS">PIS</option>
                <option value="COFINS">COFINS</option>
                <option value="ICMS">ICMS</option>
                <option value="IPI">IPI</option>
              </select>
            </div>

            <div>
              <Label htmlFor="publicoAlvo">Público-Alvo</Label>
              <Input
                id="publicoAlvo"
                value={formData.publicoAlvo}
                onChange={(e) => handleInputChange('publicoAlvo', e.target.value)}
                placeholder="Ex: Lucro Real - Indústria, Comércio e Serviços"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="grauRisco">Grau de Risco</Label>
              <select
                id="grauRisco"
                value={formData.grauRisco}
                onChange={(e) => handleInputChange('grauRisco', e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Remoto">Remoto</option>
                <option value="Baixo">Baixo</option>
                <option value="Médio">Médio</option>
                <option value="Alto">Alto</option>
              </select>
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="baseLegal">Base Legal</Label>
              <Textarea
                id="baseLegal"
                value={formData.baseLegal}
                onChange={(e) => handleInputChange('baseLegal', e.target.value)}
                placeholder="Ex: Leis nº 10.637/2002 e nº 10.833/2003..."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="contexto">Contexto do Direito</Label>
              <Textarea
                id="contexto"
                value={formData.contexto}
                onChange={(e) => handleInputChange('contexto', e.target.value)}
                placeholder="Descreva o contexto legal e aplicação da tese..."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="documentacao">Documentação Necessária</Label>
              <Textarea
                id="documentacao"
                value={formData.documentacao}
                onChange={(e) => handleInputChange('documentacao', e.target.value)}
                placeholder="Liste os documentos necessários para aplicação..."
                className="mt-1 min-h-[60px]"
              />
            </div>
          </div>
        </div>

        {/* Campos de largura completa */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="informacoes">Informações a Serem Analisadas</Label>
            <Textarea
              id="informacoes"
              value={formData.informacoes}
              onChange={(e) => handleInputChange('informacoes', e.target.value)}
              placeholder="Descreva as informações que devem ser analisadas..."
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="formaUtilizacao">Forma de Utilização</Label>
            <Textarea
              id="formaUtilizacao"
              value={formData.formaUtilizacao}
              onChange={(e) => handleInputChange('formaUtilizacao', e.target.value)}
              placeholder="Descreva como a tese deve ser utilizada..."
              className="mt-1 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Criando...' : 'Criar Tese'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
