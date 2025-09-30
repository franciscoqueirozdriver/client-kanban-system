/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ClientesPage from './page';

const mockParams = new URLSearchParams();
const mockReplace = jest.fn((url: string) => {
  const search = url.split('?')[1] ?? '';
  mockParams.forEach((_, key) => mockParams.delete(key));
  const next = new URLSearchParams(search);
  next.forEach((value, key) => mockParams.set(key, value));
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/clientes',
  useSearchParams: () => mockParams,
}));

jest.mock('@/components/Filters', () => ({ filters, onFilterChange }) => (
  <div>
    <button
      type="button"
      onClick={() => onFilterChange({ ...filters, uf: ['SP'] })}
    >
      Aplicar SP
    </button>
  </div>
));

jest.mock('@/components/client-card', () => () => <div data-testid="client-card" />);
jest.mock('@/components/NewCompanyModal', () => () => null);
jest.mock('@/components/EnrichmentPreviewDialog', () => () => null);

type MockClient = {
  id: string;
  company: string;
  segment?: string;
  size?: string;
  uf?: string;
  city?: string;
};

function buildClients(count: number, mapFn?: (index: number) => string): MockClient[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    company: `Company ${index + 1}`,
    opportunities: [],
    contacts: [],
    segment: 'Varejo',
    size: 'Grande',
    uf: mapFn ? mapFn(index) : 'SP',
    city: 'São Paulo'
  }));
}

describe('ClientesPage', () => {
  beforeEach(() => {
    mockParams.forEach((_, key) => mockParams.delete(key));
    mockReplace.mockClear();

    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (url === '/api/clientes') {
        const clients = buildClients(1200, (index) => (index < 950 ? 'SP' : 'RJ'));
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              clients,
              filters: {
                segmento: ['Varejo', 'Indústria'],
                porte: ['Pequeno', 'Médio', 'Grande'],
                uf: ['SP', 'RJ', 'MG'],
                cidade: ['São Paulo', 'Rio de Janeiro']
              }
            })
        }) as Promise<Response>;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as Promise<Response>;
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

  test('updates count when a filter is applied via MultiSelect mock', async () => {
    const user = userEvent.setup();
    render(<ClientesPage />);

    await waitFor(async () => {
      const initialSummaryCard = await screen.findByRole('article', { name: /Clientes exibidos/i });
      expect(await within(initialSummaryCard).findByText('1.200')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Aplicar SP/i }));

    await waitFor(async () => {
      const updatedSummaryCard = await screen.findByRole('article', { name: /Clientes exibidos/i });
      const updatedValueElement = await within(updatedSummaryCard).findByText('950');
      expect(updatedValueElement).toBeInTheDocument();
    });
  });
});
