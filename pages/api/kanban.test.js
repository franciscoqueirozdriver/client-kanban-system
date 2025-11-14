/** @jest-environment node */
import handler from './kanban';
import { readSheet, updateRows } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  readSheet: jest.fn(),
  updateRows: jest.fn(),
}));

describe('POST /api/kanban', () => {
  beforeEach(() => {
    readSheet.mockReset();
    updateRows.mockReset();
  });

  it('persists double-click change', async () => {
    readSheet.mockResolvedValue([{ cliente_id: '1', _rowNumber: 10 }]);
    const req = {
      method: 'POST',
      body: { id: '1', status: 'Lead Selecionado', color: 'green' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(updateRows).toHaveBeenCalled();
    const call = updateRows.mock.calls[0][1][0];
    expect(call.status_kanban).toBe('Lead Selecionado');
    expect(call.cor_card).toBe('green');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('persists drag and drop change', async () => {
    readSheet.mockResolvedValue([{ cliente_id: '1', _rowNumber: 5 }]);
    const req = {
      method: 'POST',
      body: { id: '1', destination: { droppableId: 'Contato Efetuado' } },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(updateRows).toHaveBeenCalled();
    const call = updateRows.mock.calls[0][1][0];
    expect(call.status_kanban).toBe('Contato Efetuado');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when ID not found', async () => {
    readSheet.mockResolvedValue([]);
    const req = { method: 'POST', body: { id: 'xyz', status: 'Lead Selecionado' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

