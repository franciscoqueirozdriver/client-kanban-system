// lib/mappers/fromSheet.ts
import rawMap from '@/config/planilha_mapping.json';

type AnyRow = Record<string, unknown>;
type TabKey = keyof typeof rawMap['columns'] | string;

// Resolve "SAME_AS_xxx" do JSON
function resolveTabColumns(tab: TabKey): Record<string, string> | null {
  const cols = (rawMap as any).columns?.[tab];
  if (!cols) return null;
  if (typeof cols === 'string' && cols.startsWith('SAME_AS_')) {
    const base = cols.replace('SAME_AS_', '');
    return (rawMap as any).columns?.[base] ?? null;
  }
  return cols;
}

// Converte um objeto linha (chaves = cabeçalhos originais) em snake_case via mapping
export function mapSheetRowToSnakeObject(tab: TabKey, row: AnyRow): AnyRow {
  const dict = resolveTabColumns(tab);
  if (!dict || !row) return {};

  const out: AnyRow = {};
  for (const [pt, snake] of Object.entries(dict)) {
    if (Object.prototype.hasOwnProperty.call(row, pt)) {
      out[snake] = (row as AnyRow)[pt];
    }
  }

  // Alias de compatibilidade para o front:
  // segmento ← organizacao_segmento (se segmento não existir)
  if (out.segmento === undefined && out.organizacao_segmento !== undefined) {
    out.segmento = out.organizacao_segmento;
  }
  return out;
}

// Mapeia um array de linhas
export function mapRows(tab: TabKey, rows: AnyRow[] | null | undefined): AnyRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapSheetRowToSnakeObject(tab, r));
}
