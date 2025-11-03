export function getSheetsClient(): Promise<any>;
export function getSheetData(sheetName: string, range?: string): Promise<{ headers: string[]; rows: any[] }>;
export function withRetry<T>(fn: () => Promise<T>, tries?: number): Promise<T>;
export function chunk<T>(arr: T[], size: number): T[][];
