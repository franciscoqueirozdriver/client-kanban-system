/** @jest-environment node */
import handler from './clientes';
import { getSheetCached } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  getSheetCached: jest.fn()
}));

describe('GET /api/clientes', () => {
  const header = [
    'Cliente_ID',
    'Organização - Nome',
    'Negócio - Título',
    'Negócio - Pessoa de contato',
    'Pessoa - Cargo',
    'Pessoa - Email - Work',
    'Pessoa - Email - Home',
    'Pessoa - Email - Other',
    'Pessoa - Phone - Work',
    'Pessoa - Phone - Home',
    'Pessoa - Phone - Mobile',
    'Pessoa - Phone - Other',
    'Pessoa - Telefone',
    'Pessoa - Celular',
    'Telefone Normalizado',
    'Organização - Segmento',
    'Organização - Tamanho da empresa',
    'uf',
    'cidade_estimada',
    'Status_Kanban',
    'Data_Ultima_Movimentacao',
    'Pessoa - End. Linkedin',
    'Cor_Card'
  ];

  function makeRows(count) {
    return Array.from({ length: count }, (_, i) => {
      const row = Array(header.length).fill('');
      row[0] = `id${i}`;
      row[1] = `Company ${i}`;
      return row;
    });
  }

  it('returns all clients when limit not provided', async () => {
    const rows = [header, ...makeRows(1205)];
    getSheetCached.mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(1205);
  });

  it('respects explicit limit', async () => {
    const rows = [header, ...makeRows(50)];
    getSheetCached.mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: { limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(10);
  });

  it('returns count when countOnly=1', async () => {
    const rows = [header, ...makeRows(30)];
    getSheetCached.mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: { countOnly: '1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ total: 30 });
  });
});
