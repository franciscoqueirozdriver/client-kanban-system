/** @jest-environment node */
import handler from './clientes';

jest.mock('../../lib/googleSheets', () => ({
  getSheetCached: jest.fn(),
  getSheetData: jest.fn(),
  updateRow: jest.fn(),
  appendRow: jest.fn(),
}));

const { getSheetData, getSheetCached } = jest.requireMock('../../lib/googleSheets');

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
    const rows = makeRows(1205);
    const dataRows = rows.map(row => {
      const obj = { _rowNumber: 0 };
      header.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    getSheetData.mockResolvedValue({ headers: header, rows: dataRows });

    const req = { method: 'GET', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(1205);
  });

  it('respects explicit limit', async () => {
    const rows = makeRows(50);
    const dataRows = rows.map(row => {
      const obj = { _rowNumber: 0 };
      header.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    getSheetData.mockResolvedValue({ headers: header, rows: dataRows });

    const req = { method: 'GET', query: { limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.clients).toHaveLength(10);
  });

  it('returns count when countOnly=1', async () => {
    const rows = makeRows(30);
    const dataRows = rows.map(row => {
      const obj = { _rowNumber: 0 };
      header.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    getSheetData.mockResolvedValue({ headers: header, rows: dataRows });

    const req = { method: 'GET', query: { countOnly: '1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ total: 30 });
  });
});
