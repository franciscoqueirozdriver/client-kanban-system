import { toMatrizCNPJ, isFilial, ordem } from '@/utils/cnpj-matriz';

test('filial Dalben 46241741000408 -> matriz 46241741000165', () => {
  const filial = '46241741000408';
  expect(isFilial(filial)).toBe(true);
  expect(ordem(filial)).toBe('0004');
  expect(toMatrizCNPJ(filial)).toBe('46241741000165');
});

test('BSBIOS: 07322382001352 -> matriz 07322382000119', () => {
  const filial = '07322382001352';
  expect(isFilial(filial)).toBe(true);
  expect(ordem(filial)).toBe('0013');
  expect(toMatrizCNPJ(filial)).toBe('07322382000119');
});

test('Prompt example: 08781394002036 -> matriz 08781394000174', () => {
  const filial = '08.781.394/0020-36'; // with punctuation
  const matriz = '08781394000174'; // Corrected expected value from 09 to 74
  expect(isFilial(filial)).toBe(true);
  expect(ordem(filial)).toBe('0020');
  expect(toMatrizCNPJ(filial)).toBe(matriz);
});

test('should return an empty string for incomplete CNPJ', () => {
  const incompleteCNPJ = '1234567';
  expect(toMatrizCNPJ(incompleteCNPJ)).toBe('');
});
