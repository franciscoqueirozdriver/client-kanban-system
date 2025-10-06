const naturezasMap: Record<string, string> = {
  '1.0': 'Declaração de Compensação',
  '1.1': 'Pedido de Ressarcimento',
  '1.2': 'Pedido de Restituição',
  '1.3': 'Declaração de Compensação',
  '1.5': 'Pedido de Ressarcimento',
  '1.6': 'Pedido de Restituição',
  '1.7': 'Declaração de Compensação',
  '1.8': 'Pedido de Cancelamento',
  '1.9': 'Cofins Não-Cumulativa – Ressarc/Comp.',
};

export function getNaturezaDescription(code: string): string {
  // Handle cases like "1.1/1.5" which seem to appear in the data
  if (code.includes('/')) {
    const codes = code.split('/');
    const descriptions = codes.map(c => naturezasMap[c] || c);
    // Return unique descriptions joined by '/'
    return [...new Set(descriptions)].join(' / ');
  }
  return naturezasMap[code] || code;
}