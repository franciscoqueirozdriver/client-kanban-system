
type AnyObject = { [key: string]: any };

function toSnakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/_?([A-Z]+)$/, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function mapKeysToSnakeCase(obj: AnyObject | null): AnyObject | null {
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

  const result: AnyObject = mapKeysToSnakeCase(rest) || {};
  if (empresaSnake) result.empresa = empresaSnake;
  if (contatoSnake) result.contato = contatoSnake;
  if (comercialSnake) result.comercial = comercialSnake;

  return result;
}
