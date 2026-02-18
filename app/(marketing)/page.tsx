'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart2, Shield, PieChart } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header/Navbar */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-card">
        <Link className="flex items-center justify-center" href="/">
          <span className="font-bold text-xl">Inteligência Comercial</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="#features">
            Recursos
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors" href="/login">
            Entrar
          </Link>
          <Button asChild size="sm">
            <Link href="/login">Começar Agora</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-muted/30">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  Sua Inteligência Comercial Elevada ao Próximo Nível
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Análise profunda de PER/DCOMP, gestão de teses tributárias e monitoramento de mercado em uma única plataforma integrada.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="px-8">
                  <Link href="/login">Acessar Plataforma <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" size="lg" className="px-8">
                  Ver Demonstração
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-medium">Recursos Principais</div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Tudo o que você precisa para crescer</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Ferramentas poderosas desenhadas especificamente para consultores e gestores tributários modernos.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-8 py-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="rounded-full bg-primary/10 p-4">
                  <PieChart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">PER/DCOMP Comparativo</h3>
                <p className="text-center text-muted-foreground">
                  Compare e analise declarações de compensação de forma automática, identificando discrepâncias instantaneamente.
                </p>
                <Link href="/consultas/perdecomp-comparativo" className="text-primary text-sm font-medium hover:underline">Saiba mais</Link>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="rounded-full bg-primary/10 p-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Teses Tributárias</h3>
                <p className="text-center text-muted-foreground">
                  Biblioteca completa de teses com análise de risco, fundamentação legal e acompanhamento de jurisprudência.
                </p>
                <Link href="/teses" className="text-primary text-sm font-medium hover:underline">Saiba mais</Link>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="rounded-full bg-primary/10 p-4">
                  <BarChart2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Dashboard de BI</h3>
                <p className="text-center text-muted-foreground">
                  Visualize seu pipeline de vendas, taxas de conversão e oportunidades de mercado em tempo real.
                </p>
                <Link href="/dashboard" className="text-primary text-sm font-medium hover:underline">Saiba mais</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="w-full py-12 md:py-24 bg-muted/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-2">
                <h4 className="text-4xl font-bold text-primary">500+</h4>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Empresas Analisadas</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-4xl font-bold text-primary">R$ 2B+</h4>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Créditos Identificados</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-4xl font-bold text-primary">50+</h4>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Teses Ativas</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-4xl font-bold text-primary">99%</h4>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Precisão nos Dados</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-primary text-primary-foreground">
          <div className="container px-4 md:px-6 mx-auto text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">Pronto para transformar sua operação comercial?</h2>
              <p className="opacity-90 md:text-xl">
                Junte-se aos líderes do mercado e comece a tomar decisões baseadas em dados reais e inteligência avançada.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" variant="secondary" asChild className="px-10">
                  <Link href="/login">Começar Agora</Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary px-10">
                  Falar com Consultor
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-4 sm:flex-row py-8 w-full shrink-0 items-center px-4 md:px-6 border-t bg-card">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <span className="font-bold text-lg">Inteligência Comercial</span>
          <p className="text-xs text-muted-foreground">© 2024 Inteligência Comercial. Todos os direitos reservados.</p>
        </div>
        <nav className="sm:ml-auto flex gap-6">
          <Link className="text-xs hover:text-primary transition-colors underline-offset-4" href="#">
            Termos de Uso
          </Link>
          <Link className="text-xs hover:text-primary transition-colors underline-offset-4" href="#">
            Política de Privacidade
          </Link>
          <Link className="text-xs hover:text-primary transition-colors underline-offset-4" href="#">
            Contato
          </Link>
        </nav>
      </footer>
    </div>
  );
}
