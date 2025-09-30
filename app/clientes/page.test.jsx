/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ClientesPage from './page';

jest.mock('../../components/ClientCard', () => () => <div />);
jest.mock('../../components/NewCompanyModal', () => () => null);
jest.mock('../../components/EnrichmentPreviewDialog', () => () => null);

function buildClients(count, mapFn) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    company: `Company ${i + 1}`,
    opportunities: [],
    contacts: [],
    segment: '',
    size: '',
    uf: mapFn ? mapFn(i) : '',
    city: '',
  }));
}

describe('ClientesPage total counter', () => {
  const formatter = new Intl.NumberFormat('pt-BR');

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders total count of 4384 when no filters applied', async () => {
    const clients = buildClients(4384);
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ clients, filters: { segmento: [], porte: [], uf: [], cidade: [] } }),
    });

    render(<ClientesPage />);

    const counter = await screen.findByTestId('total-clientes-exibidos');
    await waitFor(() =>
      expect(counter).toHaveTextContent(new RegExp(`Exibindo\\s*${formatter.format(4384)}`))
    );
  });

  test('updates count when UF filter is applied', async () => {
    const clients = buildClients(1200, (i) => (i < 950 ? 'SP' : 'RJ'));
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ clients, filters: { segmento: [], porte: [], uf: ['SP', 'RJ'], cidade: [] } }),
    });

    render(<ClientesPage />);

    const counter = await screen.findByTestId('total-clientes-exibidos');
    await waitFor(() =>
      expect(counter).toHaveTextContent(new RegExp(`Exibindo\\s*${formatter.format(1200)}`))
    );

    const selects = await screen.findAllByRole('combobox');
    const ufSelect = selects[1];
    await userEvent.selectOptions(ufSelect, 'SP');

    await waitFor(() =>
      expect(screen.getByTestId('total-clientes-exibidos')).toHaveTextContent(
        new RegExp(`Exibindo\\s*${formatter.format(950)}`)
      )
    );
  });
});
