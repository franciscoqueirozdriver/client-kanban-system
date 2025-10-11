import { NextResponse } from 'next/server';
import { spotterGet } from '@/lib/exactSpotter';

function normalizeFunnels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      id: item?.id ?? item?.ID ?? item?.value ?? item?.name ?? item?.Id ?? item?.Value ?? null,
      name: item?.name ?? item?.value ?? item?.nome ?? item?.Name ?? item?.Value ?? null,
    }))
    .map((item) => ({
      id: item.id != null ? String(item.id) : null,
      name: typeof item.name === 'string' ? item.name.trim() : item.name != null ? String(item.name) : null,
    }))
    .filter((item) => item.id && item.name);
}

function normalizeStages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      id: item?.id ?? item?.ID ?? item?.value ?? item?.name ?? item?.Id ?? item?.Value ?? null,
      nome: item?.value ?? item?.name ?? item?.nome ?? item?.Name ?? item?.Value ?? null,
    }))
    .map((item) => ({
      id: item.id != null ? String(item.id) : null,
      nome: typeof item.nome === 'string' ? item.nome.trim() : item.nome != null ? String(item.nome) : null,
    }))
    .filter((item) => item.nome);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const funnelId = searchParams.get('id');

  try {
    if (funnelId) {
      const encodedId = encodeURIComponent(funnelId);
      const response = await spotterGet(`Funnels/${encodedId}/Stages`);
      const stagesRaw = Array.isArray(response?.value) ? response.value : Array.isArray(response) ? response : [];
      const stages = normalizeStages(stagesRaw);
      return NextResponse.json({ stages });
    }

    const response = await spotterGet('Funnels');
    const funnelsRaw = Array.isArray(response?.value) ? response.value : Array.isArray(response) ? response : [];
    const funnels = normalizeFunnels(funnelsRaw);
    return NextResponse.json({ funnels });
  } catch (error) {
    console.error('Erro ao consultar funis/etapas no Spotter:', error);
    return NextResponse.json(
      {
        error: 'Falha ao consultar dados do Spotter.',
        details: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
