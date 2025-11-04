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

const isPgfnPageEnabled = process.env.NEXT_PUBLIC_PGFN_PAGE_ENABLED === 'true';

export default function PGFNProspecaoPage() {
  if (!isPgfnPageEnabled) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <p>Painel da PGFN temporariamente indisponível.</p>
        <p>Entre em contato com o suporte caso precise de acesso imediato.</p>
      </div>
    );
  }

  return <PainelPGFN />;
}
