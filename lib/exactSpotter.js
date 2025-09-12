// lib/exactSpotter.js
const BASE_URL = process.env.EXACT_SPOTTER_BASE_URL || 'https://api.exactspotter.com/v3';
const TOKEN    = process.env.EXACT_SPOTTER_TOKEN;

if (!TOKEN) {
  throw new Error('EXACT_SPOTTER_TOKEN ausente nas variáveis de ambiente');
}

// Normaliza telefone BR: +55 + DDD (sem 0) + número
export function normalizaTelefoneBR(telefone, ddi = '55') {
  if (!telefone) return null;
  const digits = String(telefone).replace(/\D+/g, '');
  // tenta detectar DDD com 2 dígitos e remover 0 à esquerda se existir
  let d = digits;
  if (d.startsWith('0')) d = d.slice(1);
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  if (ddd.length === 2 && numero.length >= 8) {
    return `+${ddi}${ddd}${numero}`;
  }
  // fallback: cola tudo
  return `+${ddi}${digits}`;
}

// Opcional: obter $metadata para confirmar o EntitySet
export async function getMetadata() {
  const res = await fetch(`${BASE_URL}/$metadata`, {
    headers: { token: TOKEN },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Falha $metadata: ${res.status}`);
  return res.text();
}

/**
 * Cria oportunidade no Spotter.
 * Ajuste `entitySetPath` com o nome real do EntitySet após confirmar no $metadata.
 * Usamos '/Oportunidades' como placeholder.
 */
export async function createOportunidadeSpotter(data, { entitySetPath = '/Oportunidades' } = {}) {
  const url = `${BASE_URL}${entitySetPath}`;
  const body = JSON.stringify(data);

  const backoffs = [500, 1500, 3000];
  for (let i = 0; i < backoffs.length; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        token: TOKEN, // header exigido pelo Spotter
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json'
      },
      body
    });

    if (res.status === 429 && i < backoffs.length - 1) {
      await new Promise(r => setTimeout(r, backoffs[i]));
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Spotter ${res.status}: ${t || res.statusText}`);
    }
    return res.json().catch(() => ({})); // 201 + payload
  }
  throw new Error('Rate limit do Spotter após múltiplas tentativas');
}
