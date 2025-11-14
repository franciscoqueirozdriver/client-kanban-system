/**
 * @file Contains TypeScript types for Google Sheet rows.
 */

import {
  SHEET1_COLUMNS,
  LEADS_EXACT_SPOTTER_COLUMNS,
  LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS,
  PERDECOMP_COLUMNS,
  PERDCOMP_FACTS_COLUMNS,
  PERDECOMP_SNAPSHOT_COLUMNS,
  USUARIOS_COLUMNS,
  PERMISSOES_COLUMNS
} from '@/lib/sheets-mapping';

// --- Base Row Type ---

/**
 * A generic base type for any sheet row object returned from getSheetData.
 * It includes the internal `_rowNumber` for update operations.
 */
export type BaseRow = {
  _rowNumber: number;
  [key: string]: string | number | undefined;
};

// --- Specific Row Types ---

/**
 * Creates a type from a column mapping object.
 * All properties are optional and typed as `string` by default, as data from
 * Google Sheets can be missing. Call sites should validate or provide defaults.
 */
type CreateRowType<T extends { [key: string]: string }> = {
  [K in keyof T]?: string;
} & BaseRow;

/**
 * Type definition for a row in the 'sheet1' tab.
 */
export type Sheet1Row = CreateRowType<typeof SHEET1_COLUMNS>;

/**
 * Type definition for a row in the 'leads_exact_spotter' tab.
 */
export type LeadsExactSpotterRow = CreateRowType<typeof LEADS_EXACT_SPOTTER_COLUMNS>;

/**
 * Type definition for a row in the 'layout_importacao_empresas' tab.
 */
export type LayoutImportacaoEmpresasRow = CreateRowType<typeof LAYOUT_IMPORTACAO_EMPRESAS_COLUMNS>;

/**
 * Type definition for a row in the 'perdecomp' tab.
 */
export type PerdecompRow = CreateRowType<typeof PERDECOMP_COLUMNS>;

/**
 * Type definition for a row in the 'perdcomp_facts' tab.
 */
export type PerdcompFactsRow = CreateRowType<typeof PERDCOMP_FACTS_COLUMNS>;

/**
 * Type definition for a row in the 'perdecomp_snapshot' tab.
 */
export type PerdecompSnapshotRow = CreateRowType<typeof PERDECOMP_SNAPSHOT_COLUMNS>;

/**
 * Type definition for a row in the 'usuarios' tab.
 */
export type UsuariosRow = CreateRowType<typeof USUARIOS_COLUMNS>;

/**
 * Type definition for a row in the 'permissoes' tab.
 */
export type PermissoesRow = CreateRowType<typeof PERMISSOES_COLUMNS>;
