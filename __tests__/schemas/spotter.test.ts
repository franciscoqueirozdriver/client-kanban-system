/// <reference types="jest" />
import { BundleResponse, Lead } from '@/lib/schemas/spotter';

describe('Spotter Schemas', () => {
  describe('Lead Schema', () => {
    it('should validate a correct lead object', () => {
      const leadData = { leadId: 123, saleDate: '2024-01-01' };
      const result = Lead.safeParse(leadData);
      expect(result.success).toBe(true);
    });

    it('should invalidate a lead object with incorrect types', () => {
      const leadData = { leadId: '123', saleDate: 12345 };
      const result = Lead.safeParse(leadData);
      expect(result.success).toBe(false);
    });
  });

  describe('BundleResponse Schema', () => {
    it('should validate a correct bundle response', () => {
      const bundleData = { value: [{ leadId: 1 }, { leadId: 2 }] };
      const result = BundleResponse.safeParse(bundleData);
      expect(result.success).toBe(true);
    });

    it('should invalidate a bundle response with a missing value field', () => {
      const bundleData = { items: [] };
      const result = BundleResponse.safeParse(bundleData);
      expect(result.success).toBe(false);
    });

    it('should invalidate a bundle response where value is not an array', () => {
      const bundleData = { value: 'not an array' };
      const result = BundleResponse.safeParse(bundleData);
      expect(result.success).toBe(false);
    });
  });
});
