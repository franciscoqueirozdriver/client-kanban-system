// lib/googleSheets.d.ts
declare module '@/lib/googleSheets.js' {
    export function getNextClienteId(): Promise<string>;
    export function findByCnpj(cnpj: string): Promise<any | null>;
    export function findByName(name: string): Promise<any | null>;
    export function appendToSheets(data: any): Promise<any>;
    export function updateInSheets(clienteId: string, payload: any): Promise<any>;
    export function findRowNumberByClienteId(sheetName: string, clienteId: string): Promise<number>;
    export function updateRowByIndex(options: { sheetName: string; rowIndex: number; updates: any }): Promise<any>;
    export function getSheetData(sheetName: string, range?: string, spreadsheetId?: string): Promise<{ headers: string[], rows: any[] }>;
    export function appendSheetData(options: { spreadsheetId: string, range: string, values: any[][] }): Promise<any>;
    export function updateCorCard(cardId: number, cor: string): Promise<any>;
    export function chunk(arr: any[], size: number): any[][];
    export function getSheetsClient(): Promise<any>;
    export function withRetry<T>(fn: () => Promise<T>, retries?: number): Promise<T>;
}
export {};
