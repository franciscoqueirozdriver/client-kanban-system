import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";

export default function PerDcompComparativo() {
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split("T")[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split("T")[0]);
  const [selectedPerDcomp, setSelectedPerDcomp] = useState<number | null>(null);
  const [showConcorrenteForm, setShowConcorrenteForm] = useState(false);
  const [concorrenteName, setConcorrenteName] = useState("");
  const [concorrenteCnpj, setConcorrenteCnpj] = useState("");

  const perDcompQuery = trpc.perDcomp.list.useQuery({
    nomeEmpresa: nomeEmpresa || undefined,
    cnpj: cnpj || undefined,
    dataInicio: dataInicio ? new Date(dataInicio) : undefined,
    dataFim: dataFim ? new Date(dataFim) : undefined,
  });

  const perDcompDetail = trpc.perDcomp.getWithConcorrentes.useQuery(
    { id: selectedPerDcomp! },
    { enabled: !!selectedPerDcomp }
  );

  const createPerDcompMutation = trpc.perDcomp.create.useMutation({
    onSuccess: () => {
      toast.success("PER/DCOMP criado com sucesso");
      perDcompQuery.refetch();
      setNomeEmpresa("");
      setCnpj("");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar PER/DCOMP");
    },
  });

  const createConcorrenteMutation = trpc.concorrentes.create.useMutation({
    onSuccess: () => {
      toast.success("Concorrente adicionado com sucesso");
      if (selectedPerDcomp) {
        perDcompDetail.refetch();
      }
      setConcorrenteName("");
      setConcorrenteCnpj("");
      setShowConcorrenteForm(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar concorrente");
    },
  });

  const deleteConcorrenteMutation = trpc.concorrentes.delete.useMutation({
    onSuccess: () => {
      toast.success("Concorrente removido com sucesso");
      if (selectedPerDcomp) {
        perDcompDetail.refetch();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover concorrente");
    },
  });

  const handleCreatePerDcomp = () => {
    if (!nomeEmpresa || !cnpj || !dataInicio || !dataFim) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createPerDcompMutation.mutate({
      empresaPrincipal: nomeEmpresa,
      cnpjPrincipal: cnpj,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
    });
  };

  const handleAddConcorrente = () => {
    if (!selectedPerDcomp || !concorrenteName || !concorrenteCnpj) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createConcorrenteMutation.mutate({
      perDcompId: selectedPerDcomp,
      nomeEmpresa: concorrenteName,
      cnpj: concorrenteCnpj,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">PER/DCOMP Comparativo</h1>
          <p className="text-slate-600">Compare quantitativos, naturezas de créditos e cancelamentos entre empresas no período selecionado.</p>
        </div>

        {/* Filtros e Criação */}
        <Card className="mb-8 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros da Comparação</CardTitle>
            <CardDescription>Defina a empresa principal e o período para análise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="nomeEmpresa" className="text-sm font-medium text-slate-700">
                  Nome ou CNPJ
                </Label>
                <Input
                  id="nomeEmpresa"
                  placeholder="Digite o Nome ou CNPJ"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  className="mt-2 border-slate-300"
                />
              </div>

              <div>
                <Label htmlFor="dataInicio" className="text-sm font-medium text-slate-700">
                  Período Início
                </Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-2 border-slate-300"
                />
              </div>

              <div>
                <Label htmlFor="dataFim" className="text-sm font-medium text-slate-700">
                  Período Fim
                </Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="mt-2 border-slate-300"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleCreatePerDcomp}
                  disabled={createPerDcompMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {createPerDcompMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Consultar / Atualizar Comparação
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de PER/DCOMP */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Consultas Realizadas</CardTitle>
                <CardDescription>Selecione uma consulta para visualizar detalhes e concorrentes</CardDescription>
              </CardHeader>
              <CardContent>
                {perDcompQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : perDcompQuery.data?.data && perDcompQuery.data.data.length > 0 ? (
                  <div className="space-y-3">
                    {perDcompQuery.data.data.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedPerDcomp(item.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPerDcomp === item.id
                            ? "border-purple-500 bg-purple-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="font-semibold text-slate-900">{item.empresaPrincipal}</div>
                        <div className="text-sm text-slate-600">CNPJ: {item.cnpjPrincipal}</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {new Date(item.dataInicio).toLocaleDateString("pt-BR")} a{" "}
                          {new Date(item.dataFim).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500">Nenhuma consulta realizada ainda.</p>
                    <p className="text-sm text-slate-400 mt-2">Preencha os filtros e clique em "Consultar" para começar.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes e Concorrentes */}
          <div>
            {selectedPerDcomp && perDcompDetail.data ? (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Concorrentes</CardTitle>
                  <CardDescription>Até 3 concorrentes para comparação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    {perDcompDetail.data.concorrentes && perDcompDetail.data.concorrentes.length > 0 ? (
                      perDcompDetail.data.concorrentes.map((conc) => (
                        <div key={conc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 text-sm">{conc.nomeEmpresa}</div>
                              <div className="text-xs text-slate-600">{conc.cnpj}</div>
                            </div>
                            <button
                              onClick={() => deleteConcorrenteMutation.mutate({ id: conc.id })}
                              disabled={deleteConcorrenteMutation.isPending}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Nenhum concorrente adicionado ainda.</p>
                    )}
                  </div>

                  {perDcompDetail.data.concorrentes && perDcompDetail.data.concorrentes.length < 3 && (
                    <Button
                      onClick={() => setShowConcorrenteForm(!showConcorrenteForm)}
                      variant="outline"
                      className="w-full border-slate-300"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Concorrente
                    </Button>
                  )}

                  {showConcorrenteForm && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="space-y-3">
                        <Input
                          placeholder="Nome da empresa"
                          value={concorrenteName}
                          onChange={(e) => setConcorrenteName(e.target.value)}
                          className="border-slate-300"
                        />
                        <Input
                          placeholder="CNPJ"
                          value={concorrenteCnpj}
                          onChange={(e) => setConcorrenteCnpj(e.target.value)}
                          className="border-slate-300"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddConcorrente}
                            disabled={createConcorrenteMutation.isPending}
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                          >
                            {createConcorrenteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Adicionar"
                            )}
                          </Button>
                          <Button
                            onClick={() => setShowConcorrenteForm(false)}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200">
                <CardContent className="pt-6">
                  <p className="text-center text-slate-500">Selecione uma consulta para visualizar concorrentes</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
