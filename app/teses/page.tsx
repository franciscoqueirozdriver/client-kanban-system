'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Filter, Eye, Edit, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import NovaTeseModal from '@/components/NovaTeseModal';

type Tese = {
  id: number;
  Tese_ID: string;
  Tipo: string;
  Tema: string;
  'Tributo do Crédito': string;
  'Base Legal': string;
  'Contexto do Direito': string;
  'Documentação Necessária': string;
  'Informações a Serem Analisadas': string;
  'Forma de Utilização': string;
  'Público-Alvo': string;
  'Grau de Risco': string;
  Status: string;
};

const grauRiscoColors = {
  'Remoto': 'bg-green-100 text-green-800 border-green-200',
  'Baixo': 'bg-blue-100 text-blue-800 border-blue-200',
  'Médio': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Alto': 'bg-red-100 text-red-800 border-red-200'
};

const statusColors = {
  'Ativa': 'bg-green-100 text-green-800 border-green-200',
  'Inativa': 'bg-gray-100 text-gray-800 border-gray-200'
};

export default function TesesPage() {
  const [teses, setTeses] = useState<Tese[]>([]);
  const [filteredTeses, setFilteredTeses] = useState<Tese[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedTese, setSelectedTese] = useState<Tese | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newTeseOpen, setNewTeseOpen] = useState(false);

  useEffect(() => {
    fetchTeses();
  }, []);

  useEffect(() => {
    filterTeses();
  }, [teses, searchQuery, statusFilter, riskFilter]);

  const fetchTeses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/teses');
      const data = await response.json();
      setTeses(data.teses || []);
    } catch (error) {
      console.error('Erro ao carregar teses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTeses = () => {
    let filtered = [...teses];

    // Filtro por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tese =>
        tese.Tese_ID.toLowerCase().includes(query) ||
        tese.Tema.toLowerCase().includes(query) ||
        tese.Tipo.toLowerCase().includes(query) ||
        tese['Tributo do Crédito'].toLowerCase().includes(query) ||
        tese['Público-Alvo'].toLowerCase().includes(query)
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tese => tese.Status === statusFilter);
    }

    // Filtro por grau de risco
    if (riskFilter !== 'all') {
      filtered = filtered.filter(tese => tese['Grau de Risco'] === riskFilter);
    }

    setFilteredTeses(filtered);
  };

  const toggleTeseStatus = async (teseId: string) => {
    try {
      const response = await fetch('/api/teses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          teseId
        })
      });

      if (response.ok) {
        await fetchTeses();
      }
    } catch (error) {
      console.error('Erro ao alterar status da tese:', error);
    }
  };

  const openDetails = (tese: Tese) => {
    setSelectedTese(tese);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando teses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-6 rounded-3xl border border-border bg-card px-6 py-6 shadow-soft">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Gestão Tributária</p>
          <h1 className="text-3xl font-semibold text-foreground">Teses Tributárias</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as teses de habilitação de créditos tributários PIS e COFINS.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Dialog open={newTeseOpen} onOpenChange={setNewTeseOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Tese
              </Button>
            </DialogTrigger>
            <NovaTeseModal 
              onSuccess={fetchTeses}
              onClose={() => setNewTeseOpen(false)}
            />
          </Dialog>
        </div>
      </header>

      {/* Filtros */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtros</h2>
            <p className="text-sm text-muted-foreground">Refine a visualização das teses utilizando os filtros abaixo.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, tema, tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">Todos os Status</option>
              <option value="Ativa">Ativas</option>
              <option value="Inativa">Inativas</option>
            </select>
            
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">Todos os Riscos</option>
              <option value="Remoto">Remoto</option>
              <option value="Baixo">Baixo</option>
              <option value="Médio">Médio</option>
              <option value="Alto">Alto</option>
            </select>
          </div>
        </div>
      </section>

      {/* Resumo */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Teses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teses.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teses Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {teses.filter(t => t.Status === 'Ativa').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teses Inativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {teses.filter(t => t.Status === 'Inativa').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risco Remoto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {teses.filter(t => t['Grau de Risco'] === 'Remoto').length}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Lista de Teses */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Teses Cadastradas</h2>
            <p className="text-sm text-muted-foreground">
              Exibindo {filteredTeses.length} de {teses.length} teses
            </p>
          </div>
          
          {filteredTeses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma tese encontrada com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTeses.map((tese) => (
                <Card key={tese.Tese_ID} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{tese.Tema}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm text-muted-foreground font-mono">{tese.Tese_ID}</span>
                            <Badge className={cn('text-xs', statusColors[tese.Status as keyof typeof statusColors])}>
                              {tese.Status}
                            </Badge>
                            <Badge className={cn('text-xs', grauRiscoColors[tese['Grau de Risco'] as keyof typeof grauRiscoColors])}>
                              {tese['Grau de Risco']}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{tese.Tipo}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Tributo:</span> {tese['Tributo do Crédito']}
                          </div>
                          <div>
                            <span className="font-medium">Público-Alvo:</span> {tese['Público-Alvo']}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetails(tese)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Detalhes
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTeseStatus(tese.Tese_ID)}
                          className={cn(
                            'gap-2',
                            tese.Status === 'Ativa' 
                              ? 'text-red-600 hover:text-red-700' 
                              : 'text-green-600 hover:text-green-700'
                          )}
                        >
                          {tese.Status === 'Ativa' ? (
                            <>
                              <PowerOff className="h-4 w-4" />
                              Inativar
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4" />
                              Ativar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Tese - {selectedTese?.Tese_ID}</DialogTitle>
          </DialogHeader>
          
          {selectedTese && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tema</label>
                    <p className="mt-1 text-sm">{selectedTese.Tema}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <p className="mt-1 text-sm">{selectedTese.Tipo}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tributo do Crédito</label>
                    <p className="mt-1 text-sm">{selectedTese['Tributo do Crédito']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Público-Alvo</label>
                    <p className="mt-1 text-sm">{selectedTese['Público-Alvo']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Grau de Risco</label>
                    <Badge className={cn('mt-1', grauRiscoColors[selectedTese['Grau de Risco'] as keyof typeof grauRiscoColors])}>
                      {selectedTese['Grau de Risco']}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Base Legal</label>
                    <p className="mt-1 text-sm">{selectedTese['Base Legal']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contexto do Direito</label>
                    <p className="mt-1 text-sm">{selectedTese['Contexto do Direito']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Documentação Necessária</label>
                    <p className="mt-1 text-sm">{selectedTese['Documentação Necessária']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Informações a Serem Analisadas</label>
                    <p className="mt-1 text-sm">{selectedTese['Informações a Serem Analisadas']}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Forma de Utilização</label>
                    <p className="mt-1 text-sm">{selectedTese['Forma de Utilização']}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
