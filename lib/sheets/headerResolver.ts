import { getSheetData } from "@/lib/googleSheets";

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "_")
    .replace(/__+/g, "_");
}

export async function getHeaders(sheetName: string): Promise<string[]> {
  const data = await getSheetData(sheetName, 'A1:ZZ1');
  return data[0] || [];
}

export type ColumnResolver = (logical: string) => string;

export async function buildColumnResolver(
  sheetName: string
): Promise<ColumnResolver> {
  const realHeaders = await getHeaders(sheetName);
  const normalizedMap: Record<string, string> = {};
  for (const realHeader of realHeaders) {
    normalizedMap[normalizeHeader(realHeader)] = realHeader;
  }

  return (logical: string): string => {
    const normalizedLogical = normalizeHeader(logical);
    if (normalizedMap[normalizedLogical]) {
      return normalizedMap[normalizedLogical];
    }

    // Fallbacks for common variations
    const fallbacks: Record<string, string[]> = {
      organizacao_nome: ["organizacao"],
      cnpj_empresa: ["cnpj"],
    };

    if (fallbacks[normalizedLogical]) {
      for (const fallback of fallbacks[normalizedLogical]) {
        if (normalizedMap[fallback]) {
          return normalizedMap[fallback];
        }
      }
    }

    throw new Error(
      `Missing column '${logical}' on sheet '${sheetName}' (available: ${Object.keys(
        normalizedMap
      ).join(", ")})`
    );
  };
}
