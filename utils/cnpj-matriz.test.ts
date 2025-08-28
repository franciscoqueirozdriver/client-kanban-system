import { toMatrizCNPJ, isFilial, ordem } from '@/utils/cnpj-matriz';

test('filial Dalben 46241741000408 -> matriz 46241741000165', () => {
  const filial = '46241741000408';
  expect(isFilial(filial)).toBe(true);
  expect(ordem(filial)).toBe('0004');
  expect(toMatrizCNPJ(filial)).toBe('46241741000165');
});
