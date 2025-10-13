import { NextResponse } from 'next/server';
import { listFunnels, listStages } from '@/lib/exactSpotter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [funnels, stages] = await Promise.all([listFunnels(), listStages()]);
    const stagesByFunnel = new Map<number, Array<{ id?: number; name: string; position: number }>>();

    stages.forEach((stage) => {
      const funnelId = Number(stage?.funnelId);
      const name = String(stage?.value ?? stage?.name ?? '').trim();
      if (!Number.isFinite(funnelId) || !name) return;

      const id = Number(stage?.id);
      const position = Number(stage?.position ?? 0) || 0;

      const bucket = stagesByFunnel.get(funnelId) ?? [];
      bucket.push({ id: Number.isFinite(id) ? id : undefined, name, position });
      stagesByFunnel.set(funnelId, bucket);
    });

    const pipelines = funnels
      .map((funnel) => {
        const id = Number(funnel?.id);
        if (!Number.isFinite(id)) return null;

        const name = String(funnel?.value ?? funnel?.name ?? '').trim() || `Funil ${id}`;
        const stageEntries = (stagesByFunnel.get(id) ?? [])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const seen = new Set<string>();
        const stageNames = stageEntries
          .map((entry) => entry.name)
          .filter((stageName) => {
            if (!stageName || seen.has(stageName)) return false;
            seen.add(stageName);
            return true;
          });

        return {
          id,
          name,
          stageNames,
          stages: stageEntries.map(({ id: stageId, name: stageName, position }) => ({
            id: stageId,
            name: stageName,
            position,
          })),
        };
      })
      .filter(Boolean);

    const legacyValue = pipelines.map((pipeline) => ({
      id: pipeline.id,
      value: pipeline.name,
      name: pipeline.name,
      stageNames: pipeline.stageNames,
      stages: pipeline.stages,
    }));

    return NextResponse.json({ pipelines, value: legacyValue });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'FUNNELS_ERROR' }, { status: 500 });
  }
}
