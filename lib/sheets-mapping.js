import mapping from '../config/planilha_mapping.json';

/**
 * Retorna o mapeamento de colunas para uma aba específica.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @returns {object} O objeto de mapeamento { 'Nome Original': 'snake_case' }.
 */
export function getColumnMapping(sheetName) {
    const sheetKey = mapping.tabs[sheetName] || sheetName;
    let columnMap = mapping.columns[sheetKey];

    if (columnMap === 'SAME_AS_leads_exact_spotter') {
        columnMap = mapping.columns.leads_exact_spotter;
    }

    return columnMap || {};
}

/**
 * Retorna o mapeamento inverso de colunas para uma aba específica.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @returns {object} O objeto de mapeamento inverso { 'snake_case': 'Nome Original' }.
 */
export function getReverseColumnMapping(sheetName) {
    const map = getColumnMapping(sheetName);
    const reverseMap = {};
    for (const original in map) {
        reverseMap[map[original]] = original;
    }
    return reverseMap;
}

/**
 * Converte um array de headers originais para um array de headers snake_case.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @param {string[]} originalHeaders - Array de nomes de colunas originais.
 * @returns {string[]} Array de nomes de colunas em snake_case.
 */
export function mapHeadersToSnakeCase(sheetName, originalHeaders) {
    const map = getColumnMapping(sheetName);
    const snakeCaseMap = {};
    for (const original in map) {
        snakeCaseMap[original.trim()] = map[original];
    }
    return originalHeaders.map(h => snakeCaseMap[h.trim()] || h); // Retorna o original se não houver mapeamento
}

/**
 * Converte um objeto com chaves originais para um objeto com chaves snake_case.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @param {object} originalObject - Objeto com chaves originais.
 * @returns {object} Objeto com chaves em snake_case.
 */
export function mapObjectToSnakeCase(sheetName, originalObject) {
    const map = getColumnMapping(sheetName);
    const snakeCaseMap = {};
    for (const original in map) {
        snakeCaseMap[original.trim()] = map[original];
    }

    const snakeCaseObject = {};
    for (const key in originalObject) {
        const snakeKey = snakeCaseMap[key.trim()] || key;
        snakeCaseObject[snakeKey] = originalObject[key];
    }
    return snakeCaseObject;
}

/**
 * Converte um objeto com chaves snake_case para um objeto com chaves originais.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @param {object} snakeCaseObject - Objeto com chaves snake_case.
 * @returns {object} Objeto com chaves originais.
 */
export function mapObjectToOriginal(sheetName, snakeCaseObject) {
    const reverseMap = getReverseColumnMapping(sheetName);
    const originalObject = {};
    for (const key in snakeCaseObject) {
        const originalKey = reverseMap[key.trim()] || key;
        originalObject[originalKey] = snakeCaseObject[key];
    }
    return originalObject;
}

/**
 * Retorna o nome da coluna original dado o nome snake_case para uma aba específica.
 * @param {string} sheetName - O nome da aba (snake_case).
 * @param {string} snakeCaseName - O nome da coluna em snake_case.
 * @returns {string | undefined} O nome da coluna original.
 */
export function getOriginalColumnName(sheetName, snakeCaseName) {
    const reverseMap = getReverseColumnMapping(sheetName);
    return reverseMap[snakeCaseName];
}
