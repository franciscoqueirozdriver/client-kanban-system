import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Eye, Power } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function TesesTributarias() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativa" | "inativa" | undefined>();
  const [riscoFilter, setRiscoFilter] = useState<"remoto" | "baixo" | "medio" | "alto" | undefined>();
  const [selectedTese, setSelectedTese] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tema: "",
    tipo: "",
    tributo: "",
    publicoAlvo: "",
    grauRisco: "baixo" as const,
    baseLegal: "",
    contextoDoireito: "",
    tributoDoCredito: "",
    documentacaoNecessaria: "",
    informacoesAnalise: "",
    formaUtilizacao: "",
    status: "inativa" as const,
    ativa: false,
  });

  const tesasQuery = trpc.teses.list.useQuery({
    search: search || undefined,
    status: statusFilter,
    risco: riscoFilter,
    limit: 50,
  });

  const statsQuery = trpc.teses.stats.useQuery();

  const createTeseMutation = trpc.teses.create.useMutation({
    onSuccess: () => {
      toast.success("Tese criada com sucesso");
      tesasQuery.refetch();
      statsQuery.refetch();
      setFormData({
        tema: "",
        tipo: "",
        tributo: "",
        publicoAlvo: "",
        grauRisco: "baixo",
        baseLegal: "",
        contextoDoireito: "",
        tributoDoCredito: "",
        documentacaoNecessaria: "",
        informacoesAnalise: "",
        formaUtilizacao: "",
        status: "inativa",
        ativa: false,
      });
      setShowForm(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar tese");
    },
  });

  const toggleStatusMutation = trpc.teses.toggleStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso");
      tesasQuery.refetch();
      statsQuery.refetch();
      setSelectedTese(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status");
    },
  });

  const handleCreateTese = () => {
    if (!formData.tema || !formData.tipo || !formData.tributo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    createTeseMutation.mutate(formData);
  };

  const handleToggleStatus = (teseId: number) => {
    toggleStatusMutation.mutate({ id: teseId });
  };

  const getRiscoColor = (risco: string) => {
    switch (risco) {
      case "remoto":
        return "bg-green-100 text-green-800";
      case "baixo":
        return "bg-blue-100 text-blue-800";
      case "medio":
        return "bg-yellow-100 text-yellow-800";
      case "alto":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getRiscoLabel = (risco: string) => {
    switch (risco) {
      case "remoto":
        return "Remoto";
      case "baixo":
        return "Baixo";
      case "medio":
        return "Médio";
      case "alto":
        return "Alto";
      default:
        return risco;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Teses Tributárias</h1>
            <p className="text-slate-600">Gerencie as teses de habilitação de créditos tributários PIS e COFINS.</p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nova Tese
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova Tese Tributária</DialogTitle>
                <DialogDescription>Preencha os dados da nova tese tributária</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tema" className="text-sm font-medium">
                      Tema *
                    </Label>
                    <Input
                      id="tema"
                      value={formData.tema}
                      onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                      placeholder="Digite o tema"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipo" className="text-sm font-medium">
                      Tipo *
                    </Label>
                    <Input
                      id="tipo"
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      placeholder="Digite o tipo"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tributo" className="text-sm font-medium">
                      Tributo *
                    </Label>
                    <Input
                      id="tributo"
                      value={formData.tributo}
                      onChange={(e) => setFormData({ ...formData, tributo: e.target.value })}
                      placeholder="Digite o tributo"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="publicoAlvo" className="text-sm font-medium">
                      Público-Alvo
                    </Label>
                    <Input
                      id="publicoAlvo"
                      value={formData.publicoAlvo}
                      onChange={(e) => setFormData({ ...formData, publicoAlvo: e.target.value })}
                      placeholder="Digite o público-alvo"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grauRisco" className="text-sm font-medium">
                      Grau de Risco
                    </Label>
                    <Select value={formData.grauRisco} onValueChange={(value: any) => setFormData({ ...formData, grauRisco: value })}>
                      <SelectTrigger id="grauRisco" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remoto">Remoto</SelectItem>
                        <SelectItem value="baixo">Baixo</SelectItem>
                        <SelectItem value="medio">Médio</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="tributoDoCredito" className="text-sm font-medium">
                      Tributo do Crédito
                    </Label>
                    <Input
                      id="tributoDoCredito"
                      value={formData.tributoDoCredito}
                      onChange={(e) => setFormData({ ...formData, tributoDoCredito: e.target.value })}
                      placeholder="Digite o tributo do crédito"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="baseLegal" className="text-sm font-medium">
                    Base Legal
                  </Label>
                  <Textarea
                    id="baseLegal"
                    value={formData.baseLegal}
                    onChange={(e) => setFormData({ ...formData, baseLegal: e.target.value })}
                    placeholder="Digite a base legal"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="contextoDoireito" className="text-sm font-medium">
                    Contexto do Direito
                  </Label>
                  <Textarea
                    id="contextoDoireito"
                    value={formData.contextoDoireito}
                    onChange={(e) => setFormData({ ...formData, contextoDoireito: e.target.value })}
                    placeholder="Digite o contexto do direito"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="documentacaoNecessaria" className="text-sm font-medium">
                    Documentação Necessária
                  </Label>
                  <Textarea
                    id="documentacaoNecessaria"
                    value={formData.documentacaoNecessaria}
                    onChange={(e) => setFormData({ ...formData, documentacaoNecessaria: e.target.value })}
                    placeholder="Digite a documentação necessária"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="informacoesAnalise" className="text-sm font-medium">
                    Informações a Serem Analisadas
                  </Label>
                  <Textarea
                    id="informacoesAnalise"
                    value={formData.informacoesAnalise}
                    onChange={(e) => setFormData({ ...formData, informacoesAnalise: e.target.value })}
                    placeholder="Digite as informações a serem analisadas"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="formaUtilizacao" className="text-sm font-medium">
                    Forma de Utilização
                  </Label>
                  <Textarea
                    id="formaUtilizacao"
                    value={formData.formaUtilizacao}
                    onChange={(e) => setFormData({ ...formData, formaUtilizacao: e.target.value })}
                    placeholder="Digite a forma de utilização"
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCreateTese}
                    disabled={createTeseMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {createTeseMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Tese"
                    )}
                  </Button>
                  <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        {statsQuery.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-slate-900">{statsQuery.data.total}</div>
                <p className="text-sm text-slate-600 mt-2">Total de Teses</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-600">{statsQuery.data.ativas}</div>
                <p className="text-sm text-slate-600 mt-2">Teses Ativas</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-slate-600">{statsQuery.data.inativas}</div>
                <p className="text-sm text-slate-600 mt-2">Teses Inativas</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-red-600">{statsQuery.data.riscoRemoto}</div>
                <p className="text-sm text-slate-600 mt-2">Risco Remoto</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card className="mb-8 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine a visualização das teses utilizando os filtros abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search" className="text-sm font-medium text-slate-700">
                  Buscar por ID, tema, tipo...
                </Label>
                <Input
                  id="search"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mt-2 border-slate-300"
                />
              </div>

              <div>
                <Label htmlFor="status" className="text-sm font-medium text-slate-700">
                  Todos os Status
                </Label>
                <Select value={statusFilter || ""} onValueChange={(value) => setStatusFilter(value as any || undefined)}>
                  <SelectTrigger id="status" className="mt-2">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Status</SelectItem>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="inativa">Inativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="risco" className="text-sm font-medium text-slate-700">
                  Todos os Riscos
                </Label>
                <Select value={riscoFilter || ""} onValueChange={(value) => setRiscoFilter(value as any || undefined)}>
                  <SelectTrigger id="risco" className="mt-2">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Riscos</SelectItem>
                    <SelectItem value="remoto">Remoto</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teses Grid */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Teses Cadastradas
            {tesasQuery.data && (
              <span className="text-sm font-normal text-slate-600 ml-2">
                Exibindo {tesasQuery.data.data.length} de {tesasQuery.data.total} teses
              </span>
            )}
          </h2>

          {tesasQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : tesasQuery.data?.data && tesasQuery.data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tesasQuery.data.data.map((tese) => (
                <Card key={tese.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{tese.tema}</CardTitle>
                        <CardDescription className="text-xs mt-1">Tributo: {tese.tributo}</CardDescription>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiscoColor(tese.grauRisco)}`}>
                        {getRiscoLabel(tese.grauRisco)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-600">Tipo:</span>
                        <span className="text-slate-900 ml-2">{tese.tipo}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Público-Alvo:</span>
                        <span className="text-slate-900 ml-2">{tese.publicoAlvo || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Status:</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${tese.status === "ativa" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}`}>
                          {tese.status === "ativa" ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-6 py-3 bg-slate-50 rounded-b-lg flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setSelectedTese(tese)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detalhes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalhes da Tese</DialogTitle>
                        </DialogHeader>
                        {selectedTese && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-slate-700">Tema</Label>
                                <p className="text-slate-900 mt-1">{selectedTese.tema}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-slate-700">Tipo</Label>
                                <p className="text-slate-900 mt-1">{selectedTese.tipo}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-slate-700">Tributo</Label>
                                <p className="text-slate-900 mt-1">{selectedTese.tributo}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-slate-700">Grau de Risco</Label>
                                <p className="text-slate-900 mt-1">{getRiscoLabel(selectedTese.grauRisco)}</p>
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700">Público-Alvo</Label>
                              <p className="text-slate-900 mt-1">{selectedTese.publicoAlvo || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700">Base Legal</Label>
                              <p className="text-slate-900 mt-1">{selectedTese.baseLegal || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700">Contexto do Direito</Label>
                              <p className="text-slate-900 mt-1">{selectedTese.contextoDoireito || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-700">Documentação Necessária</Label>
                              <p className="text-slate-900 mt-1">{selectedTese.documentacaoNecessaria || "—"}</p>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      onClick={() => handleToggleStatus(tese.id)}
                      disabled={toggleStatusMutation.isPending}
                      variant="outline"
                      size="sm"
                      className={`flex-1 border-slate-300 ${tese.status === "ativa" ? "text-red-600" : "text-green-600"}`}
                    >
                      {toggleStatusMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Power className="w-4 h-4 mr-1" />
                          {tese.status === "ativa" ? "Desativar" : "Ativar"}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <p className="text-center text-slate-500">Nenhuma tese encontrada com os filtros selecionados.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
