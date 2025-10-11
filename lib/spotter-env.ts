// lib/spotter-env.ts
export function getSpotterToken(): string {
  // Ordem de fallback p/ retrocompatibilidade
  return (
    process.env.SPOTTER_TOKEN ||
    process.env.EXACT_SPOTTER_TOKEN ||
    process.env.EXACTSPOTTER_TOKEN ||
    process.env.TOKEN_EXACT ||
    ''
  );
}

export function assertSpotterToken() {
  const t = getSpotterToken();
  if (!t) {
    // não explode em prod; as rotas retornam 500 elegante
    console.warn('[spotter] token ausente: verifique env var SPOTTER_TOKEN/EXACT_SPOTTER_TOKEN');
  }
  return t;
}

const readEnvList = (name: string): string[] | undefined => {
  const value = process.env[name];
  if (!value) return undefined;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export function getSpotterAreasValidas(): string[] | undefined {
  return readEnvList('SPOTTER_AREAS_VALIDAS');
}

export function getSpotterModalidadesValidas(): string[] | undefined {
  return readEnvList('SPOTTER_MODALIDADES_VALIDAS');
}