// app/kanban/page.tsx
import { Suspense } from 'react';
import type { KanbanData } from '../../lib/types';
import KanbanClientComponent from './KanbanClientComponent';
import BannerWarning from '@/components/BannerWarning';

const isProd = process.env.NODE_ENV === 'production';

async function getKanbanData(): Promise<KanbanData> {
  // Use NEXT_PUBLIC_BASE_URL for client-side, or a default for server-side
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/kanban`,
    isProd ? { next: { revalidate: 60 } } : { cache: 'no-store' }
  );

  if (!res.ok) {
    console.error('KANBAN_FETCH_FAILED');
    // Return empty data structure on failure
    return [];
  }

  try {
    const data: KanbanData = await res.json();
    return data;
  } catch (error) {
    console.error('Error parsing Kanban data:', error);
    // Return empty data structure on parsing error
    return [];
  }
}

export default async function KanbanPageWrapper() {
  const kanbanData: KanbanData = await getKanbanData();

  if (!Array.isArray(kanbanData) || kanbanData.length === 0) {
    return (
      <div className="flex flex-col gap-6 overflow-x-hidden">
        <BannerWarning title="Dados indisponíveis" />
      </div>
    );
  }

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <KanbanClientComponent initialData={kanbanData} />
    </Suspense>
  );
}
