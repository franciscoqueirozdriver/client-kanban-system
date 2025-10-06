import { normalizeCnpj, isCnpj, ensureValidCnpj, formatCnpj, isEmptyCNPJLike } from './cnpj';

describe('CNPJ utils', () => {
  describe('normalizeCnpj', () => {
    it('should normalize a CNPJ with less than 14 digits by padding with zeros', () => {
      expect(normalizeCnpj('123456789012')).toBe('00123456789012');
    });

    it('should not change a CNPJ with 14 digits', () => {
      expect(normalizeCnpj('12345678901234')).toBe('12345678901234');
    });

    it('should remove non-digit characters and not pad a 14-digit CNPJ', () => {
      expect(normalizeCnpj('12.345.678/9012-34')).toBe('12345678901234');
    });

    it('should remove non-digit characters and pad a short CNPJ', () => {
        expect(normalizeCnpj('12.345.678/90-12')).toBe('00123456789012');
    });
  });

  describe('isCnpj', () => {
    it('should return true for a valid CNPJ', () => {
      expect(isCnpj('54.550.752/0001-55')).toBe(true);
    });

    it('should return false for an invalid CNPJ', () => {
      expect(isCnpj('12.345.678/9012-35')).toBe(false);
    });

    it('should return false for a CNPJ with all same digits', () => {
      expect(isCnpj('11111111111111')).toBe(false);
    });
  });

  describe('ensureValidCnpj', () => {
    it('should return a valid CNPJ', () => {
      expect(ensureValidCnpj('54.550.752/0001-55')).toBe('54550752000155');
    });

    it('should throw an error for an invalid CNPJ', () => {
      expect(() => ensureValidCnpj('12.345.678/9012-35')).toThrow('CNPJ inválido');
    });
  });

  describe('formatCnpj', () => {
    it('should format a CNPJ', () => {
      expect(formatCnpj('54550752000155')).toBe('54.550.752/0001-55');
    });

    it('should format a partial CNPJ by padding it first', () => {
        expect(formatCnpj('545507520001')).toBe('00.545.507/5200-01');
    });
  });

  describe('isEmptyCNPJLike', () => {
    it('should return true for an empty string', () => {
        expect(isEmptyCNPJLike('')).toBe(true);
    });
    it('should return true for a null value', () => {
        expect(isEmptyCNPJLike(null)).toBe(true);
    });
    it('should return true for an undefined value', () => {
        expect(isEmptyCNPJLike(undefined)).toBe(true);
    });
    it('should return true for zeros', () => {
        expect(isEmptyCNPJLike('000.000.000/0000-00')).toBe(true);
    });
    it('should return false for a valid cnpj', () => {
        expect(isEmptyCNPJLike('54.550.752/0001-55')).toBe(false);
    });
  });
});