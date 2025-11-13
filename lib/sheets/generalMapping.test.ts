
import { normalizePayloadToSnakeCase } from './generalMapping';

describe('normalizePayloadToSnakeCase', () => {
  it('should convert a nested payload with PascalCase keys to snake_case', () => {
    const payload = {
      cliente_id: 'CLT-1234',
      Empresa: {
        NomeDaEmpresa: 'Empresa Teste',
        CNPJ_Empresa: '12.345.678/0001-90',
      },
      Contato: {
        NomeContato: 'João Silva',
        EmailContato: 'joao.silva@teste.com',
      },
      Comercial: {
        Origem: 'Website',
        Produto: 'Produto A',
      },
    };

    const expected = {
      cliente_id: 'CLT-1234',
      empresa: {
        nome_da_empresa: 'Empresa Teste',
        cnpj_empresa: '12.345.678/0001-90',
      },
      contato: {
        nome_contato: 'João Silva',
        email_contato: 'joao.silva@teste.com',
      },
      comercial: {
        origem: 'Website',
        produto: 'Produto A',
      },
    };

    expect(normalizePayloadToSnakeCase(payload)).toEqual(expected);
  });

  it('should handle payloads with missing nested objects', () => {
    const payload = {
      cliente_id: 'CLT-1234',
      Empresa: {
        NomeDaEmpresa: 'Empresa Teste',
      },
    };

    const expected = {
      cliente_id: 'CLT-1234',
      empresa: {
        nome_da_empresa: 'Empresa Teste',
      },
    };

    expect(normalizePayloadToSnakeCase(payload)).toEqual(expected);
  });

  it('should return an empty object if the payload is null or undefined', () => {
    expect(normalizePayloadToSnakeCase(null)).toEqual({});
    expect(normalizePayloadToSnakeCase(undefined)).toEqual({});
  });
});
