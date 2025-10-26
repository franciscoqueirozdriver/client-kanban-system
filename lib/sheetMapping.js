/**
 * Módulo de mapeamento de nomes de abas e colunas
 * Fonte da verdade: config/planilha_mapping.json
 */

import fs from 'fs';
import path from 'path';

let mappingCache = null;

function loadMapping() {
  if (mappingCache) return mappingCache;

  try {
    const mappingPath = path.join(process.cwd(), 'config', 'planilha_mapping.json');
    const rawData = fs.readFileSync(mappingPath, 'utf-8');
    mappingCache = JSON.parse(rawData);
    return mappingCache;
  } catch (error) {
    console.error('Erro ao carregar mapeamento de planilha:', error);
    throw new Error('Falha ao carregar config/planilha_mapping.json');
  }
}

/**
 * Obtém o novo nome de uma aba (sheet) baseado no nome legado
 * @param {string} legacySheetName - Nome legado da aba
 * @returns {string} - Novo nome normalizado
 */
export function getSheetName(legacySheetName) {
  const mapping = loadMapping();
  return mapping.sheets[legacySheetName] || legacySheetName;
}

/**
 * Obtém o novo nome de uma coluna baseado no nome legado
 * @param {string} legacyColumnName - Nome legado da coluna
 * @returns {string} - Novo nome normalizado
 */
export function getColumnName(legacyColumnName) {
  const mapping = loadMapping();
  return mapping.columns[legacyColumnName] || legacyColumnName;
}

/**
 * Obtém todos os nomes de abas normalizados
 * @returns {object} - Mapa de abas legadas para normalizadas
 */
export function getSheetNames() {
  const mapping = loadMapping();
  return mapping.sheets;
}

/**
 * Obtém todos os nomes de colunas normalizados
 * @returns {object} - Mapa de colunas legadas para normalizadas
 */
export function getColumnNames() {
  const mapping = loadMapping();
  return mapping.columns;
}

/**
 * Obtém o mapeamento completo
 * @returns {object} - Objeto com sheets e columns
 */
export function getFullMapping() {
  return loadMapping();
}

