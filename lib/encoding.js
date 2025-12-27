// lib/encoding.js
// Corrige textos UTF-8 que chegaram como Latin-1 (mojibake típico: "SÃ£o Paulo")
export function fixEncoding(s) {
  if (typeof s !== 'string') return s;
  try {
    // Se já está correto, este passo é idempotente para casos comuns
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch {
    return s;
  }
}

// Saneador simples adicional (fallback) para alguns padrões frequentes
export function deMojibake(s = '') {
  return s
    .replace(/SÃ£o/g, 'São')
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ãª/g, 'ê')
    .replace(/Ã§/g, 'ç').replace(/Ã£/g, 'ã').replace(/Ã€/g, 'À');
}

// Aplica correção robusta
export function normalizeText(s) {
  return deMojibake(fixEncoding(s));
}
