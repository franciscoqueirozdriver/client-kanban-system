import { recordPending } from './techdebt.js';

export const toSnake = (value) => {
  if (!value) return '';
  let normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normalized = normalized
    .toLowerCase()
    .replace(/[\s\-\/\.\(\)\[\]\{\}:;]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized;
};

export const SHEET_ALIASES = {
  'leads exact spotter': 'leads_exact_spotter',
  leads_exact_spotter: 'leads_exact_spotter',
  perdecomp: 'perdecomp_legacy',
  perdecomp_itens: 'perdecomp_itens',
  perdecomp_snapshot: 'perdecomp_snapshot',
  perdecomp_facts: 'perdecomp_facts',
  padroes: 'padroes',
  mensagens: 'mensagens',
  sheet1: 'sheet1',
  layout_importacao_empresas: 'layout_importacao_empresas',
};

export const COLUMN_ALIASES = {
  cliente_id: 'cliente_id',
  nome_da_empresa: 'empresa_nome',
  empresa: 'empresa_nome',
  empresa_nome: 'empresa_nome',
  cnpj: 'cnpj',
  no_per_dcomp: 'perdecomp_numero',
  numero_perdcomp: 'perdecomp_numero',
  perdcomp_numero: 'perdecomp_numero',
  tipo: 'tipo_documento',
  tipo_documento: 'tipo_documento',
  natureza: 'natureza_codigo',
  natureza_codigo: 'natureza_codigo',
  credito: 'credito_tipo',
  credito_tipo: 'credito_tipo',
  periodo_apuracao: 'periodo_apuracao',
  data_protocolo: 'data_protocolo',
  data_decisao: 'data_decisao',
  status: 'status',
  valor_bruto: 'valor_bruto',
  valor_compensado: 'valor_compensado',
  valor_restituicao: 'valor_restituicao',
  observacoes: 'observacoes',
  inserido_em: 'inserted_at',
  inserido_at: 'inserted_at',
  ultima_consulta_em: 'snapshot_at',
  snapshot_at: 'snapshot_at',
  resumo: 'resumo_json',
  resumo_json: 'resumo_json',
  total_creditos: 'total_creditos',
  total_compensado: 'total_compensado',
  total_restituicao: 'total_restituicao',
  status_predominante: 'status_predominante',
};

const allowLegacyHeaders = () =>
  (process?.env?.SHEETS_ALLOW_LEGACY_HEADERS ?? 'true').toLowerCase() !== 'false';

export function resolveSheetName(requested, availableSheets) {
  const normalizedAvailable = new Set((availableSheets || []).map((s) => toSnake(s || '')));

  if (availableSheets?.includes(requested)) {
    return { resolved: requested, usedFallback: false };
  }

  const requestedSnake = toSnake(requested);
  if (normalizedAvailable.has(requestedSnake)) {
    const resolved = availableSheets.find((s) => toSnake(s) === requestedSnake) || requestedSnake;
    console.warn('[sheets:name-fallback]', { requested, resolved });
    recordPending({
      type: 'sheet-name-fallback',
      requested,
      resolved,
      extra: { available: Array.from(normalizedAvailable).slice(0, 50) },
    });
    return { resolved, usedFallback: true };
  }

  const alias = SHEET_ALIASES[requestedSnake] || SHEET_ALIASES[requested.toLowerCase?.() || ''];
  if (alias && normalizedAvailable.has(alias)) {
    const resolved = availableSheets.find((s) => toSnake(s) === alias) || alias;
    console.warn('[sheets:alias-hit]', { requested, resolved });
    recordPending({ type: 'sheet-alias-hit', requested, resolved });
    return { resolved, usedFallback: true };
  }

  return { resolved: null, usedFallback: false };
}

export function mapHeaders(headers) {
  const seen = new Set();
  return headers.map((header, idx) => {
    const original = String(header ?? '').trim();
    const normalized = toSnake(original);
    const canonical = allowLegacyHeaders() ? COLUMN_ALIASES[normalized] || normalized : normalized;

    let name = canonical || `col_${idx + 1}`;
    let candidate = name;
    let suffix = 2;
    while (candidate && seen.has(candidate)) {
      candidate = `${name}_${suffix++}`;
    }
    if (candidate) {
      seen.add(candidate);
    }

    if (candidate !== original) {
      console.warn('[sheets:header-map]', { from: original, to: candidate });
      recordPending({ type: 'header-map', requested: original, resolved: candidate });
    }

    return candidate;
  });
}
