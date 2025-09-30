import {
  normalizeCnpj,
  generatePerdcompId,
  nextClienteId,
  isValidClienteIdPattern,
  isValidPerdcompIdPattern,
  isValidCnpjPattern,
  zeroPad,
} from './normalizers.js';

describe('Normalizer Utilities', () => {
  describe('zeroPad', () => {
    it('should pad a number with leading zeros to a specified length', () => {
      expect(zeroPad(5, 4)).toBe('0005');
      expect(zeroPad(123, 4)).toBe('0123');
      expect(zeroPad(1234, 4)).toBe('1234');
      expect(zeroPad(1, 2)).toBe('01');
    });
  });

  describe('normalizeCnpj', () => {
    it('should remove non-digit characters', () => {
      expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
    });

    it('should left-pad with zeros if less than 14 digits', () => {
      expect(normalizeCnpj('123456789012')).toBe('00123456789012');
    });

    it('should return the last 14 digits if more than 14 digits', () => {
      expect(normalizeCnpj('98765432109876543210')).toBe('32109876543210');
    });

    it('should handle special placeholder cases', () => {
      expect(normalizeCnpj("'0879")).toBe('00000000000879');
      expect(normalizeCnpj('0')).toBe('00000000000000');
      expect(normalizeCnpj(57)).toBe('00000000000057');
    });

    it('should return an empty string for null, undefined, or empty inputs', () => {
      expect(normalizeCnpj(null)).toBe('');
      expect(normalizeCnpj(undefined)).toBe('');
      expect(normalizeCnpj('')).toBe('');
      expect(normalizeCnpj('abc')).toBe('');
    });
  });

  describe('generatePerdcompId', () => {
    it('should generate an ID in the correct format', () => {
      const now = new Date('2025-08-18T02:55:43.000Z');
      const rand = () => 0.12345; // Deterministic "random" for testing
      const id = generatePerdcompId(now, rand);
      expect(isValidPerdcompIdPattern(id)).toBe(true);

      // Check parts of the generated ID
      const parts = id.split('-');
      expect(parts[0]).toBe('PDC');
      expect(parts[1]).toBe('20250818');
      expect(parts[2]).toBe('025543');
      expect(parts[3]).toMatch(/^[A-Z0-9]{4}$/);
    });
  });

  describe('nextClienteId', () => {
    it('should return CLT-0001 if no IDs exist', async () => {
      const fetcher = async () => [];
      const nextId = await nextClienteId(fetcher);
      expect(nextId).toBe('CLT-0001');
    });

    it('should increment the largest existing valid ID', async () => {
      const existingIds = ['CLT-0001', 'CLT-0050', 'CLT-0002'];
      const fetcher = async () => existingIds;
      const nextId = await nextClienteId(fetcher);
      expect(nextId).toBe('CLT-0051');
    });

    it('should ignore invalid formats and find the correct next ID', async () => {
      const existingIds = ['CLT-0001', '168', 'CLI-0004', 'COMP-123', 'CLT-0556', 'invalid-id'];
      const fetcher = async () => existingIds;
      const nextId = await nextClienteId(fetcher);
      expect(nextId).toBe('CLT-0557');
    });

    it('should handle an empty list of IDs', async () => {
        const fetcher = async () => [];
        const nextId = await nextClienteId(fetcher);
        expect(nextId).toBe('CLT-0001');
    });

    it('should handle a list with only invalid IDs', async () => {
        const existingIds = ['invalid-1', '123', 'CLI-456'];
        const fetcher = async () => existingIds;
        const nextId = await nextClienteId(fetcher);
        expect(nextId).toBe('CLT-0001');
    });
  });

  describe('Validation Patterns', () => {
    it('isValidClienteIdPattern should validate correctly', () => {
      expect(isValidClienteIdPattern('CLT-1234')).toBe(true);
      expect(isValidClienteIdPattern('CLT-123')).toBe(false);
      expect(isValidClienteIdPattern('CLI-1234')).toBe(false);
      expect(isValidClienteIdPattern('CLT-ABCD')).toBe(false);
    });

    it('isValidPerdcompIdPattern should validate correctly', () => {
      expect(isValidPerdcompIdPattern('PDC-20250818-025543-8KD2')).toBe(true);
      expect(isValidPerdcompIdPattern('PDC-20250818-025543-8KD')).toBe(false);
      expect(isValidPerdcompIdPattern('PDC-20250818-02554-8KD2')).toBe(false);
      expect(isValidPerdcompIdPattern('PDC-2025081-025543-8KD2')).toBe(false);
      expect(isValidPerdcompIdPattern('PDC-20250818-025543-8KD_')).toBe(false);
    });

    it('isValidCnpjPattern should validate correctly', () => {
      expect(isValidCnpjPattern('12345678901234')).toBe(true);
      expect(isValidCnpjPattern('1234567890123')).toBe(false);
      expect(isValidCnpjPattern('123456789012345')).toBe(false);
      expect(isValidCnpjPattern('1234567890ABCD')).toBe(false);
    });
  });
});