/** @jest-environment node */
import handler from './clientes';
import { getSheetCached } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  getSheetCached: jest.fn()
}));

describe('GET /api/clientes', () => {
  const header = [
    'cliente_id',
    'nome_da_empresa',
    'negocio_titulo',
    'negocio_pessoa_de_contato',
    'pessoa_cargo',
    'pessoa_email_work',
    'pessoa_email_home',
    'pessoa_email_other',
    'pessoa_phone_work',
    'pessoa_phone_home',
    'pessoa_phone_mobile',
    'pessoa_phone_other',
    'pessoa_telefone',
    'pessoa_celular',
    'telefone_normalizado',
    'organizacao_segmento',
    'organizacao_tamanho_da_empresa',
    'uf',
    'cidade_estimada',
    'status_kanban',
    'data_ultima_movimentacao',
    'pessoa_end_linkedin',
    'cor_card'
  ];

  function makeRows(count: number) {
    return Array.from({ length: count }, (_, i) => {
      const row = Array(header.length).fill('');
      row[0] = `id${i}`;
      row[1] = `Company ${i}`;
      return row;
    });
  }

  it('returns all clients when limit not provided', async () => {
    const rows = [header, ...makeRows(1205)];
    (getSheetCached as jest.Mock).mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(1205);
  });

  it('respects explicit limit', async () => {
    const rows = [header, ...makeRows(50)];
    (getSheetCached as jest.Mock).mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: { limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(10);
  });

  it('returns count when countOnly=1', async () => {
    const rows = [header, ...makeRows(30)];
    (getSheetCached as jest.Mock).mockResolvedValue({ data: { values: rows } });

    const req = { method: 'GET', query: { countOnly: '1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ total: 30 });
  });
});
