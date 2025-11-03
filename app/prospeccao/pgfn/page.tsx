import NextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const PainelPGFN = NextDynamic(
  () => import('@/features/pgfn/PainelPgfnProspecao'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Carregando painel da PGFN...
      </div>
    ),
  },
);

export default function PGFNProspecaoPage() {
  return <PainelPGFN />;
}
