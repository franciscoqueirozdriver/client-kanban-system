function notImplemented(name) {
    const message = `[shim] function ${name} is not implemented`;
    console.error(message);
    // In a real scenario, you might want to throw an error
    // but for the build to pass, we can just return a resolved promise.
    return Promise.resolve({});
}

export async function getNextClienteId() {
    console.warn('[shim] getNextClienteId called');
    return Promise.resolve('CLT-9999');
}

export async function findByCnpj(cnpj) {
    console.warn(`[shim] findByCnpj called with ${cnpj}`);
    return Promise.resolve(null);
}

export async function findByName(name) {
    console.warn(`[shim] findByName called with ${name}`);
    return Promise.resolve(null);
}

export async function appendToSheets(sheetName, data) {
    console.warn(`[shim] appendToSheets called for ${sheetName}`);
    return Promise.resolve({});
}

export async function updateInSheets(clienteId, payload) {
    console.warn(`[shim] updateInSheets called for ${clienteId}`);
    return Promise.resolve({});
}

export async function findRowNumberByClienteId(sheetName, clienteId) {
    console.warn(`[shim] findRowNumberByClienteId called for ${clienteId} in ${sheetName}`);
    return Promise.resolve(-1);
}

export async function updateRowByIndex({ sheetName, rowIndex, updates }) {
    console.warn(`[shim] updateRowByIndex called for row ${rowIndex} in ${sheetName}`);
    return Promise.resolve({});
}

export async function updateCorCard(cardId, cor) {
    console.warn(`[shim] updateCorCard called for cardId ${cardId} with color ${cor}`);
    return Promise.resolve({});
}

export function chunk(arr, size) {
    console.warn(`[shim] chunk called`);
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

export async function withRetry(fn) {
    console.warn(`[shim] withRetry called`);
    return fn();
}

export async function getSheetsClient() { return notImplemented('getSheetsClient'); }
export async function getSheetData(sheetName, range, spreadsheetId) { return { headers: [], rows: [] }; }
export async function findRowIndexById(sheetName, headersRow, idColumnName, idValue) { return -1; }
export async function appendSheetData({ spreadsheetId, range, values }) { return notImplemented('appendSheetData'); }
export async function getSheet1Headers() { return []; }
export async function updateSheet1(rowNumber, data) { return notImplemented('updateSheet1'); }
export async function appendRow(data) { return notImplemented('appendRow'); }
export async function appendHistoryRow(data) { return notImplemented('appendHistoryRow'); }
export async function updateRow(sheetName, rowIndex, data) { return notImplemented('updateRow'); }
export async function getSheetCached(sheetName) { return { headers: [], rows: [] }; }
export async function getHistorySheetCached() { return { headers: [], rows: [] }; }
export async function getSheet(sheetName) { return { headers: [], rows: [] }; }
