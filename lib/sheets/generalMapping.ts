
type AnyObject = { [key: string]: any };

function toSnakeCase(str: string): string {
  if (str.toLowerCase() === 'cnpj_empresa') return 'cnpj_empresa';
    const upper = str.replace(/([A-Z])/g, '_$1').toLowerCase();
  return upper.startsWith('_') ? upper.substring(1) : upper;
}

function mapKeysToSnakeCase(obj: AnyObject | null): AnyObject {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = toSnakeCase(key);
    acc[snakeKey] = obj[key];
    return acc;
  }, {} as AnyObject);
}

export function normalizePayloadToSnakeCase(payload: AnyObject): AnyObject {
  if (!payload) return {};

  const { Empresa, Contato, Comercial, ...rest } = payload;

  const empresaSnake = mapKeysToSnakeCase(Empresa);
  const contatoSnake = mapKeysToSnakeCase(Contato);
  const comercialSnake = mapKeysToSnakeCase(Comercial);

  const result: AnyObject = { ...rest };
  if (empresaSnake) result.empresa = empresaSnake;
  if (contatoSnake) result.contato = contatoSnake;
  if (comercialSnake) result.comercial = comercialSnake;

  return result;
}
