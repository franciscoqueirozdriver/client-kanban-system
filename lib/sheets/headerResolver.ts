import { getSheetData } from "@/lib/googleSheets";
import { SheetName } from "../sheets-mapping";

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "_")
    .replace(/__+/g, "_");
}

export type ColumnResolver = (logical: string) => string;

/**
 * Creates a function that resolves a logical column name to the actual header
 * found in the sheet. This implementation assumes headers are already in
 * snake_case or can be normalized to it.
 * @param sheetName The name of the sheet.
 * @returns A column resolver function.
 */
export async function buildColumnResolver(
  sheetName: SheetName
): Promise<ColumnResolver> {
  const { headers } = await getSheetData(sheetName, 'A1:ZZ1');
  const realHeaders = headers || [];
  const normalizedMap: Record<string, string> = {};
  for (const realHeader of realHeaders) {
    normalizedMap[normalizeHeader(realHeader)] = realHeader;
  }

  return (logical: string): string => {
    const normalizedLogical = normalizeHeader(logical);
    // Directly return the header if a normalized version exists in the map.
    // Otherwise, return the original logical name as a fallback.
    return normalizedMap[normalizedLogical] || logical;
  };
}
