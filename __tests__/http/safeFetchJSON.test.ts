/// <reference types="jest" />
/** @jest-environment node */
import { safeFetchJSON } from '@/lib/http/safeFetchJSON';

global.fetch = jest.fn();

describe('safeFetchJSON', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should return JSON data on successful fetch', async () => {
    const mockData = { message: 'Success' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockData,
    });

    const data = await safeFetchJSON('http://example.com/data');
    expect(data).toEqual(mockData);
  });

  it('should throw an error for non-ok responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'Not Found',
    });

    await expect(safeFetchJSON('http://example.com/notfound')).rejects.toThrow('HTTP 404 (text/plain) Not Found');
  });

  it('should throw an error for non-JSON responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      text: async () => '<h1>Hello</h1>',
    });

    await expect(safeFetchJSON('http://example.com/html')).rejects.toThrow('Non-JSON (text/html) <h1>Hello</h1>');
  });

  it('should handle timeouts', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 150))
    );

    await expect(safeFetchJSON('http://example.com/slow', { timeoutMs: 100 })).rejects.toThrow();
  });
});
