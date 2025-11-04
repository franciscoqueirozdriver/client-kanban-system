export function getSheetsClient(): Promise<any>;
export function getSheetData(sheetName: string, range?: string): Promise<{ headers: string[]; rows: any[] }>;
export function withRetry<T>(fn: () => Promise<T>, tries?: number): Promise<T>;
export function chunk<T>(arr: T[], size: number): T[][];
export function getNextClienteId(): Promise<string>;
export function findByCnpj(cnpj: string): Promise<any>;
export function findByName(name: string): Promise<any>;
export function appendToSheets(sheetName: string, data: any): Promise<void>;
export function updateInSheets(clienteId: string, payload: Record<string, any>): Promise<void>;
export function updateCorCard(cardId: string | number, cor: string): Promise<void>;
export function findRowIndexById(sheetName: string, headersRow: number, idColumnName: string, idValue: string | number): Promise<number>;
export function updateRowByIndex({ sheetName, rowIndex, updates }: { sheetName: string, rowIndex: number, updates: Record<string, any> }): Promise<void>;
export function findRowNumberByClienteId(sheetName: string, clienteId: string): Promise<number>;
export function appendSheetData(args: {
  spreadsheetId: string;
  range: string;
  values: unknown[][];
  valueInputOption?: string;
}): Promise<any>;

export function updateSheet1(rowNumber: number, data: any): Promise<void>;
export function appendRow(data: any): Promise<any>;
export function appendHistoryRow(data: any): Promise<any>;
export function updateRow(sheetName: string, rowIndex: number, data: any): Promise<any>;
export function getSheetCached(sheetName: string): Promise<any>;
export function getHistorySheetCached(): Promise<any>;
export function getSheet(sheetName: string): Promise<any>;
