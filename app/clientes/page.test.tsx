/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { act } from 'react';
import ClientesPage from './page';

jest.mock('../../components/ClientCard', () => () => <div data-testid="client-card" />);
jest.mock('../../components/NewCompanyModal', () => () => null);
jest.mock('../../components/EnrichmentPreviewDialog', () => () => null);

function buildClients(count: number, mapFn?: (i: number) => string) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    company: `Company ${i + 1}`,
    opportunities: [],
    contacts: [],
    segment: 'Varejo',
    size: 'Grande',
    uf: mapFn ? mapFn(i) : 'SP',
    city: 'São Paulo',
  }));
}

describe('ClientesPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url === '/api/clientes') {
        const clients = buildClients(1200, (i) => (i < 950 ? 'SP' : 'RJ'));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients,
            filters: {
              segmento: ['Varejo', 'Indústria'],
              porte: ['Pequeno', 'Médio', 'Grande'],
              uf: ['SP', 'RJ', 'MG'],
              cidade: ['São Paulo', 'Rio de Janeiro'],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders total count of clients when no filters applied', async () => {
    render(<ClientesPage />);

    await waitFor(async () => {
      const summaryCard = await screen.findByRole('article', { name: /Clientes exibidos/i });
      const valueElement = await within(summaryCard).findByText('1.200');
      expect(valueElement).toBeInTheDocument();
    });
  });

  test('updates count when a filter is applied via MultiSelect', async () => {
    const user = userEvent.setup();
    render(<ClientesPage />);

    await waitFor(async () => {
      const initialSummaryCard = await screen.findByRole('article', { name: /Clientes exibidos/i });
      expect(await within(initialSummaryCard).findByText('1.200')).toBeInTheDocument();
    });

    const ufFilterButton = screen.getByRole('combobox', { name: /UF/i });
    await act(async () => {
      await user.click(ufFilterButton);
    });

    const optionSP = await screen.findByRole('option', { name: /SP/i });
    await act(async () => {
      await user.click(optionSP);
    });

    await waitFor(async () => {
      const updatedSummaryCard = await screen.findByRole('article', { name: /Clientes exibidos/i });
      expect(await within(updatedSummaryCard).findByText('950')).toBeInTheDocument();
    });
  });
});
