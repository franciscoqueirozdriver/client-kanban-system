export * from '../src/utils/cnpj';

import {
  ensureValidCnpj,
  formatCNPJ,
  formatCnpj,
  isCnpj,
  isEmptyCNPJLike,
  isValidCNPJ,
  normalizeCNPJ,
  normalizeCnpj,
  onlyDigits,
  padCNPJ14,
  toDigits,
} from '../src/utils/cnpj';

const cnpj = {
  ensureValidCnpj,
  formatCNPJ,
  formatCnpj,
  isCnpj,
  isEmptyCNPJLike,
  isValidCNPJ,
  normalizeCNPJ,
  normalizeCnpj,
  onlyDigits,
  padCNPJ14,
  toDigits,
};

export default cnpj;
