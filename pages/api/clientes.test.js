/** @jest-environment node */
import handler from './clientes';
import { getSheetData } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  getSheetData: jest.fn(),
}));

describe('GET /api/clientes', () => {
  const headers = [
    'cliente_id',
    'nome_da_empresa',
    'segmento',
    'tamanho_da_empresa',
    'uf',
    'cidade_estimada',
    'status_kanban',
    'data_ultima_movimentacao',
    'cor_card',
  ];

  function makeRows(count) {
    return Array.from({ length: count }, (_, i) => ({
      cliente_id: `id${i}`,
      nome_da_empresa: `Company ${i}`,
      segmento: '',
      tamanho_da_empresa: '',
      uf: '',
      cidade_estimada: '',
      status_kanban: '',
      data_ultima_movimentacao: '',
      cor_card: '',
    }));
  }

  it('returns all clients when limit not provided', async () => {
    const rows = makeRows(1205);
    getSheetData.mockResolvedValue({ headers, rows });

    const req = { method: 'GET', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(1205);
  });

  it('respects explicit limit', async () => {
    const rows = makeRows(50);
    getSheetData.mockResolvedValue({ headers, rows });

    const req = { method: 'GET', query: { limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(10);
  });

  it('returns count when countOnly=1', async () => {
    const rows = makeRows(30);
    getSheetData.mockResolvedValue({ headers, rows });

    const req = { method: 'GET', query: { countOnly: '1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ total: 30 });
  });
});
