/// <reference types="jest" />
/** @jest-environment node */
import { GET } from '@/app/api/spotter/route';
import { safeFetchJSON } from '@/lib/http/safeFetchJSON';

jest.mock('@/lib/http/safeFetchJSON');
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
    })),
  },
}));


const mockedSafeFetchJSON = safeFetchJSON as jest.Mock;

describe('Spotter API Proxy Route', () => {
  beforeEach(() => {
    mockedSafeFetchJSON.mockClear();
    process.env.SPOTTER_API_BASE = 'https://api.exactspotter.com/v3';
    process.env.SPOTTER_TOKEN = 'test-token';
  });

  it('should return 400 if resource is missing', async () => {
    const req = new Request('http://localhost/api/spotter');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ ok: false, error: 'Missing resource' });
  });

  it('should successfully proxy the request and return data', async () => {
    const mockData = { value: [{ leadId: 1 }] };
    mockedSafeFetchJSON.mockResolvedValue(mockData);

    const req = new Request('http://localhost/api/spotter?resource=Bundle&funnels=123');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, data: mockData });
    expect(mockedSafeFetchJSON).toHaveBeenCalledWith(
      'https://api.exactspotter.com/v3/Bundle?funnels=123',
      { headers: { token_exact: 'test-token' } }
    );
  });

  it('should handle upstream HTTP 401 errors gracefully', async () => {
    mockedSafeFetchJSON.mockRejectedValue(new Error('HTTP 401'));

    const req = new Request('http://localhost/api/spotter?resource=Bundle');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ ok: false, error: 'HTTP 401' });
  });

  it('should handle upstream non-JSON errors gracefully', async () => {
    mockedSafeFetchJSON.mockRejectedValue(new Error('Non-JSON response'));

    const req = new Request('http://localhost/api/spotter?resource=Bundle');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toEqual({ ok: false, error: 'Non-JSON response' });
  });

  it('should handle other upstream errors with a 500 status', async () => {
    mockedSafeFetchJSON.mockRejectedValue(new Error('Something went wrong'));

    const req = new Request('http://localhost/api/spotter?resource=Bundle');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ ok: false, error: 'Something went wrong' });
  });
});
