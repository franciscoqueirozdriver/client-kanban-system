import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { BarChart3, FileText, TrendingUp } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-lg mb-4">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Sistema de Inteligência Comercial</h1>
            <p className="text-slate-400">Gestão tributária simplificada e inteligente</p>
          </div>

          <Card className="border-slate-700 bg-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Bem-vindo</CardTitle>
              <CardDescription>Faça login para acessar o sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={getLoginUrl()}>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  Fazer Login
                </Button>
              </a>
            </CardContent>
          </Card>

          <div className="mt-8 grid grid-cols-1 gap-4">
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white">PER/DCOMP Comparativo</h3>
                  <p className="text-sm text-slate-400">Compare quantitativos e créditos entre empresas</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white">Teses Tributárias</h3>
                  <p className="text-sm text-slate-400">Gerencie teses de habilitação de créditos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Bem-vindo, {user?.name || "Usuário"}!</h1>
          <p className="text-slate-600">Sistema de Inteligência Comercial - Gestão Tributária</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/per-dcomp")}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">PER/DCOMP Comparativo</CardTitle>
                  <CardDescription>Compare quantitativos, naturezas de créditos e cancelamentos</CardDescription>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Realize consultas de períodos de apuração (PER/DCOMP) e compare dados entre empresas concorrentes.
              </p>
              <Button className="mt-4 bg-purple-600 hover:bg-purple-700">Acessar</Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/teses")}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">Teses Tributárias</CardTitle>
                  <CardDescription>Gerencie teses de habilitação de créditos tributários</CardDescription>
                </div>
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Crie, edite e gerencie teses de habilitação de créditos tributários PIS e COFINS com filtros avançados.
              </p>
              <Button className="mt-4 bg-purple-600 hover:bg-purple-700">Acessar</Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-white rounded-lg border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Sobre o Sistema</h2>
          <p className="text-slate-600 mb-4">
            O Sistema de Inteligência Comercial foi desenvolvido para facilitar a gestão tributária, permitindo:
          </p>
          <ul className="space-y-2 text-slate-600">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
              Consultas de PER/DCOMP com comparação entre empresas
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
              Gerenciamento completo de teses tributárias
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
              Exportação e importação de dados
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
              Filtros avançados e busca por status e risco
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
