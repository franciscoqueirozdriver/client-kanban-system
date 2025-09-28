import {
  zeroPad,
  normalizeCnpj,
  generatePerdcompId,
  nextClienteId,
  isValidClienteIdPattern,
  isValidPerdcompIdPattern,
  isValidCnpjPattern,
} from './normalizers';

describe('Normalizer Utilities', () => {
  // Test suite for zeroPad
  describe('zeroPad', () => {
    test('should pad a number with leading zeros to the default length of 4', () => {
      expect(zeroPad(5)).toBe('0005');
    });
    test('should pad a number to a specified length', () => {
      expect(zeroPad(5, 6)).toBe('000005');
    });
    test('should not pad a number that is already at the target length', () => {
      expect(zeroPad(1234, 4)).toBe('1234');
    });
    test('should handle zero correctly', () => {
      expect(zeroPad(0, 2)).toBe('00');
    });
  });

  // Test suite for normalizeCnpj
  describe('normalizeCnpj', () => {
    test('should remove non-digit characters and left-pad with zeros', () => {
      expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
    });
    test('should handle CNPJs with less than 14 digits by padding', () => {
      expect(normalizeCnpj('123456789012')).toBe('00123456789012');
    });
    test("should handle Excel's leading apostrophe", () => {
      expect(normalizeCnpj("'09403252000190")).toBe('09403252000190');
    });
    test('should handle placeholder values like "0", "1", "57"', () => {
      expect(normalizeCnpj('0')).toBe('00000000000000');
      expect(normalizeCnpj('57')).toBe('00000000000057');
    });
    test('should return an empty string for null, undefined, or empty inputs', () => {
      expect(normalizeCnpj(null)).toBe('');
      expect(normalizeCnpj(undefined)).toBe('');
      expect(normalizeCnpj('')).toBe('');
      expect(normalizeCnpj('   ')).toBe('');
    });
    test('should throw an error for CNPJs with more than 14 digits', () => {
      expect(() => normalizeCnpj('123456789012345')).toThrow('Invalid CNPJ: contains more than 14 digits');
    });
    test('should be idempotent', () => {
      const cnpj = '12.345.678/0001-90';
      const normalizedOnce = normalizeCnpj(cnpj);
      const normalizedTwice = normalizeCnpj(normalizedOnce);
      expect(normalizedTwice).toBe('12345678000190');
    });
  });

  // Test suite for generatePerdcompId
  describe('generatePerdcompId', () => {
    test('should generate an ID matching the specified format', () => {
      const id = generatePerdcompId();
      expect(isValidPerdcompIdPattern(id)).toBe(true);
    });
    test('should use UTC for the timestamp', () => {
      const date = new Date('2025-08-18T12:00:00Z'); // Explicitly UTC
      const id = generatePerdcompId(date);
      expect(id.startsWith('PDC-20250818-120000')).toBe(true);
    });
    test('should generate a 4-character uppercase base-36 suffix', () => {
      const id = generatePerdcompId();
      const suffix = id.split('-')[3];
      expect(suffix).toMatch(/^[A-Z0-9]{4}$/);
    });
    test('should be deterministic when a seed is provided', () => {
      const date = new Date();
      const seed = 0.12345;
      const id1 = generatePerdcompId(date, seed);
      const id2 = generatePerdcompId(date, seed);
      expect(id1).toBe(id2);
    });
  });

  // Test suite for nextClienteId
  describe('nextClienteId', () => {
    test('should return CLT-0001 for an empty list of IDs', async () => {
      const fetcher = async () => [];
      const nextId = await nextClienteId(fetcher);
      expect(nextId).toBe('CLT-0001');
    });
    test('should correctly find the max ID and increment from a mixed list', async () => {
      const ids = ['CLT-0001', 'CLT-0556', '168', 'CLI-000004', 'COMP-123', 'CLT-0100'];
      const fetcher = async () => ids;
      const nextId = await nextClienteId(fetcher);
      expect(nextId).toBe('CLT-0557');
    });
    test('should ignore invalid or non-matching formats', async () => {
        const ids = ['some-random-id', 'CLT-555', 'CLIENTE-0001', null, undefined];
        const fetcher = async () => ids as any;
        const nextId = await nextClienteId(fetcher);
        expect(nextId).toBe('CLT-0001');
    });
  });

  // Test suite for validators
  describe('Validators', () => {
    test('isValidClienteIdPattern should validate the pattern correctly', () => {
      expect(isValidClienteIdPattern('CLT-1234')).toBe(true);
      expect(isValidClienteIdPattern('CLT-123')).toBe(false);
      expect(isValidClienteIdPattern('CLI-1234')).toBe(false);
      expect(isValidClienteIdPattern(1234)).toBe(false);
    });

    test('isValidPerdcompIdPattern should validate the pattern correctly', () => {
      expect(isValidPerdcompIdPattern('PDC-20250818-120000-A1B2')).toBe(true);
      expect(isValidPerdcompIdPattern('PDC-20250818-120000-a1b2')).toBe(false); // Must be uppercase
      expect(isValidPerdcompIdPattern('PDC-20250818-1200-A1B2')).toBe(false); // Invalid time
      expect(isValidPerdcompIdPattern(null)).toBe(false);
    });

    test('isValidCnpjPattern should validate the pattern correctly', () => {
      expect(isValidCnpjPattern('12345678901234')).toBe(true);
      expect(isValidCnpjPattern('1234567890123')).toBe(false);
      expect(isValidCnpjPattern('123456789012345')).toBe(false);
      expect(isValidCnpjPattern('abc')).toBe(false);
    });
  });
});