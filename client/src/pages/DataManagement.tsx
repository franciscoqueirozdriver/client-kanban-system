import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Download, Upload, FileJson } from "lucide-react";

export default function DataManagement() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"teses" | "perDcomp" | "concorrentes">("teses");

  const exportTesesMutation = trpc.teses.export.useQuery();
  const exportPerDcompMutation = trpc.perDcomp.export.useQuery();
  const exportConcorrentesMutation = trpc.concorrentes.export.useQuery();

  const importTesesMutation = trpc.teses.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} teses importadas com sucesso`);
      setImportFile(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao importar teses");
    },
  });

  const importPerDcompMutation = trpc.perDcomp.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} PER/DCOMP importados com sucesso`);
      setImportFile(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao importar PER/DCOMP");
    },
  });

  const importConcorrentesMutation = trpc.concorrentes.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} concorrentes importados com sucesso`);
      setImportFile(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao importar concorrentes");
    },
  });

  const handleExport = (type: "teses" | "perDcomp" | "concorrentes") => {
    let data: any[] = [];
    let filename = "";

    if (type === "teses" && exportTesesMutation.data) {
      data = exportTesesMutation.data;
      filename = "teses.json";
    } else if (type === "perDcomp" && exportPerDcompMutation.data) {
      data = exportPerDcompMutation.data;
      filename = "per-dcomp.json";
    } else if (type === "concorrentes" && exportConcorrentesMutation.data) {
      data = exportConcorrentesMutation.data;
      filename = "concorrentes.json";
    }

    if (data.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${data.length} registros exportados`);
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecione um arquivo para importar");
      return;
    }

    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast.error("O arquivo deve conter um array JSON");
        return;
      }

      if (importType === "teses") {
        importTesesMutation.mutate({ data });
      } else if (importType === "perDcomp") {
        importPerDcompMutation.mutate({ data });
      } else if (importType === "concorrentes") {
        importConcorrentesMutation.mutate({ data });
      }
    } catch (error) {
      toast.error("Erro ao ler o arquivo JSON");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Gerenciamento de Dados</h1>
          <p className="text-slate-600">Exporte e importe dados do sistema para backup e migração.</p>
        </div>

        {/* Exportação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-600" />
                Exportar Teses
              </CardTitle>
              <CardDescription>Baixe todas as teses tributárias em JSON</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleExport("teses")}
                disabled={exportTesesMutation.isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {exportTesesMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" />
                    Exportar
                  </>
                )}
              </Button>
              {exportTesesMutation.data && (
                <p className="text-sm text-slate-600 mt-2">
                  {exportTesesMutation.data.length} teses disponíveis
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-600" />
                Exportar PER/DCOMP
              </CardTitle>
              <CardDescription>Baixe todas as consultas PER/DCOMP em JSON</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleExport("perDcomp")}
                disabled={exportPerDcompMutation.isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {exportPerDcompMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" />
                    Exportar
                  </>
                )}
              </Button>
              {exportPerDcompMutation.data && (
                <p className="text-sm text-slate-600 mt-2">
                  {exportPerDcompMutation.data.length} consultas disponíveis
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-600" />
                Exportar Concorrentes
              </CardTitle>
              <CardDescription>Baixe todos os concorrentes em JSON</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleExport("concorrentes")}
                disabled={exportConcorrentesMutation.isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {exportConcorrentesMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" />
                    Exportar
                  </>
                )}
              </Button>
              {exportConcorrentesMutation.data && (
                <p className="text-sm text-slate-600 mt-2">
                  {exportConcorrentesMutation.data.length} concorrentes disponíveis
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Importação */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-600" />
              Importar Dados
            </CardTitle>
            <CardDescription>Importe dados de um arquivo JSON para o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Tipo de Dados
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="teses">Teses Tributárias</option>
                  <option value="perDcomp">PER/DCOMP</option>
                  <option value="concorrentes">Concorrentes</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Selecione o arquivo JSON
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={
                    !importFile ||
                    importTesesMutation.isPending ||
                    importPerDcompMutation.isPending ||
                    importConcorrentesMutation.isPending
                  }
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {importTesesMutation.isPending ||
                  importPerDcompMutation.isPending ||
                  importConcorrentesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar
                    </>
                  )}
                </Button>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Dica:</strong> O arquivo JSON deve conter um array de objetos com a mesma estrutura dos dados exportados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
