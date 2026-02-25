// app/reports/page.tsx  (SERVER COMPONENT)
import { Suspense } from 'react';
import ReportsClient from './reports-client';

type Search = { [key: string]: string | string[] | undefined };

export default function ReportsPage({ searchParams }: { searchParams: Search }) {
  // Leia tudo que precisa dos params AQUI (server)
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const view = typeof searchParams.view === 'string' ? searchParams.view : 'summary';
  // Passe como props para o client
  return (
    <Suspense fallback={<div>Carregando relatórios...</div>}>
      <ReportsClient initialQuery={q} initialView={view} />
    </Suspense>
  );
}
