import { joinUrl } from './url.js';

describe('joinUrl', () => {
  test('joins without duplicate slashes', () => {
    expect(joinUrl('https://api.exactspotter.com/v3', 'Leads')).toBe('https://api.exactspotter.com/v3/Leads');
    expect(joinUrl('https://api.exactspotter.com/v3/', '/Leads')).toBe('https://api.exactspotter.com/v3/Leads');
  });
});
