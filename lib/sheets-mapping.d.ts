export function getColumnMapping(sheetName: string): Record<string, string>;
export function getReverseColumnMapping(sheetName: string): Record<string, string>;
export function mapHeadersToSnakeCase(sheetName: string, originalHeaders: string[]): string[];
export function mapObjectToSnakeCase(sheetName: string, originalObject: Record<string, any>): Record<string, any>;
export function mapObjectToOriginal(sheetName: string, snakeCaseObject: Record<string, any>): Record<string, any>;
export function getOriginalColumnName(sheetName: string, snakeCaseName: string): string | undefined;
export function mapSheetRowToSnakeObject(sheetName: string, headers: string[], row: any[]): Record<string, any>;
