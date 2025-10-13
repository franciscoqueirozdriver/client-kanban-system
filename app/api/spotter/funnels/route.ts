import { NextResponse } from 'next/server';
import { listFunnels, spotterGet } from '@/lib/exactSpotter';

export const dynamic = 'force-dynamic';

async function getStagesForFunnel(funnelId) {
  try {
    const stagesResponse = await spotterGet(`Funnels/${funnelId}/Stages`);
    const rawStages = Array.isArray(stagesResponse?.value)
      ? stagesResponse.value
      : Array.isArray(stagesResponse)
      ? stagesResponse
      : [];
    return rawStages.map(stage => String(stage.name ?? stage.value ?? ""));
  } catch (error) {
    console.error(`Failed to fetch stages for funnel ${funnelId}:`, error);
    return [];
  }
}

export async function GET() {
  try {
    const funnels = await listFunnels();
    const pipelines = await Promise.all(
      funnels.map(async (funnel) => {
        const stageNames = await getStagesForFunnel(funnel.id);
        return {
          id: funnel.id,
          name: funnel.value,
          stageNames,
        };
      })
    );

    return NextResponse.json({ pipelines });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'FUNNELS_ERROR';
    return NextResponse.json({ error }, { status: 500 });
  }
}