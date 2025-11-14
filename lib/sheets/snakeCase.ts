import { BaseRow } from '@/types/sheets';

/**
 * Creates a reverse mapping from a columns object.
 * E.g., { cliente_id: 'Cliente ID' } => { 'Cliente ID': 'cliente_id' }
 */
function createHeaderToSnakeCaseMap(columns: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key in columns) {
    const value = columns[key];
    map[value] = key;
  }
  return map;
}

/**
 * Maps a raw sheet row (with arbitrary header strings) to a snake_case object.
 * @param row The raw row object from getSheetData.
 * @param headers The array of headers from the sheet.
 * @param columns The corresponding `*_COLUMNS` mapping object.
 * @returns A new object with snake_case keys.
 */
export function mapSheetRowToSnakeCase<T extends BaseRow>(
  row: Record<string, string | number | undefined>,
  headers: string[],
  columns: Record<string, string>
): T {
  const headerMap = createHeaderToSnakeCaseMap(columns);
  const snakeRow: Partial<T> = { _rowNumber: row._rowNumber as number } as Partial<T>;

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const snakeKey = headerMap[header];
    if (snakeKey) {
      (snakeRow as any)[snakeKey] = row[header];
    } else {
      // Keep unmapped headers as-is, just in case
      (snakeRow as any)[header] = row[header];
    }
  }

  return snakeRow as T;
}
