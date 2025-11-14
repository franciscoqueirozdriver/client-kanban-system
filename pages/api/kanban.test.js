/** @jest-environment node */
import handler from './kanban';
import { findRowIndexById, updateRowByIndex } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  getSheetCached: jest.fn(),
  findRowIndexById: jest.fn(),
  updateRowByIndex: jest.fn(),
}));

describe('POST /api/kanban', () => {
  beforeEach(() => {
    findRowIndexById.mockReset();
    updateRowByIndex.mockReset();
  });

  it('persists double-click change', async () => {
    findRowIndexById.mockResolvedValue(10);
    const req = {
      method: 'POST',
      body: { id: '1', status: 'Lead Selecionado', color: 'green' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(findRowIndexById).toHaveBeenCalledWith('sheet1', 1, 'cliente_id', '1');
    expect(updateRowByIndex).toHaveBeenCalled();
    const call = updateRowByIndex.mock.calls[0][0];
    expect(call.updates.status_kanban).toBe('Lead Selecionado');
    expect(call.updates.cor_card).toBe('green');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('persists drag and drop change', async () => {
    findRowIndexById.mockResolvedValue(5);
    const req = {
      method: 'POST',
      body: { id: '1', destination: { droppableId: 'Contato Efetuado' } },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(updateRowByIndex).toHaveBeenCalled();
    const call = updateRowByIndex.mock.calls[0][0];
    expect(call.updates.status_kanban).toBe('Contato Efetuado');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when ID not found', async () => {
    findRowIndexById.mockResolvedValue(-1);
    const req = { method: 'POST', body: { id: 'xyz', status: 'Lead Selecionado' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

