/** @jest-environment node */
import { NextResponse } from 'next/server';

// Polyfill Request/Response for Node env if missing
if (!global.Request) {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input;
      this.method = init?.method || 'GET';
      this.body = init?.body;
    }
    json() {
      return JSON.parse(this.body);
    }
  } as any;
}

// Now import the route
import { POST } from './route';
import { loadSnapshotCard } from '@/lib/perdecomp-persist';
import { POST as sheetsCnpjHandler } from '@/app/api/sheets/cnpj/route';

jest.mock('@/lib/perdecomp-persist', () => ({
  loadSnapshotCard: jest.fn(),
  findClienteIdByCnpj: jest.fn(),
}));

jest.mock('@/lib/googleSheets', () => ({
  getSheetsClient: jest.fn(),
}));

jest.mock('@/app/api/sheets/cnpj/route', () => ({
  POST: jest.fn(),
}));

jest.mock('@/utils/cnpj', () => ({
  onlyDigits: (s: string) => s.replace(/\D/g, ''),
}));

jest.mock('@/utils/perdcomp', () => ({
  agregaPerdcomp: jest.fn(() => ({
    total: 10,
    totalSemCancelamento: 10,
    canc: 0,
    porFamilia: {},
    porNaturezaAgrupada: {},
  })),
}));

describe('POST /api/perdecomp/snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to sheetsCnpjHandler when forceRefresh is true, then reads snapshot', async () => {
    // Mock the delegate handler to return success
    (sheetsCnpjHandler as jest.Mock).mockResolvedValue(
      NextResponse.json({ ok: true })
    );

    // Mock loadSnapshotCard to return a valid snapshot
    (loadSnapshotCard as jest.Mock).mockResolvedValue({
      cliente_id: 'CLT-1234',
      perdcomp: [{ perdcomp: '123' }],
      perdcompCodigos: ['123'],
      resumo: { total: 1 },
      header: { requested_at: '2024-01-01' },
    });

    const body = {
      clienteId: 'CLT-1234',
      cnpj: '12.345.678/0001-90',
      forceRefresh: true,
      startDate: '2023-01-01',
      endDate: '2023-12-31',
    };

    const req = new Request('http://localhost/api/perdecomp/snapshot', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const response = await POST(req);
    const json = await response.json();

    // Verify delegate was called
    expect(sheetsCnpjHandler).toHaveBeenCalledTimes(1);

    // Check call args manually since we polyfilled Request
    const delegateCallArg = (sheetsCnpjHandler as jest.Mock).mock.calls[0][0];
    const delegateBody = await delegateCallArg.json();

    expect(delegateBody).toMatchObject({
        clienteId: 'CLT-1234',
        cnpj: '12345678000190',
        force: true,
        data_inicio: '2023-01-01',
        data_fim: '2023-12-31',
    });

    // Verify snapshot was loaded AFTER delegate
    expect(loadSnapshotCard).toHaveBeenCalledWith({ clienteId: 'CLT-1234' });

    // Verify response
    expect(json).toMatchObject({
        ok: true,
        fonte: 'perdecomp_snapshot',
        perdcompCodigos: ['123'],
    });
  });

  it('loads snapshot directly when forceRefresh is false', async () => {
    (loadSnapshotCard as jest.Mock).mockResolvedValue({
        cliente_id: 'CLT-1234',
        perdcomp: [],
        header: { requested_at: '2024-01-01' },
    });

    const body = {
      clienteId: 'CLT-1234',
      cnpj: '12345678000190',
      forceRefresh: false,
    };

    const req = new Request('http://localhost/api/perdecomp/snapshot', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    await POST(req);

    expect(sheetsCnpjHandler).not.toHaveBeenCalled();
    expect(loadSnapshotCard).toHaveBeenCalledWith({ clienteId: 'CLT-1234' });
  });
});
