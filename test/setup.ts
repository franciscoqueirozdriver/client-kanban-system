import { vi, expect } from 'vitest';
import '@testing-library/jest-dom';

// Compat simples: redireciona jest -> vi
// (cobre jest.fn, jest.mock, jest.spyOn, etc.)
(globalThis as any).jest = vi;

// Alguns testes precisam de fetch/jsdom estáveis
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = vi.fn();
}

// Exporta expect p/ IDE
export { expect };
