/** @jest-environment node */
import { GET } from './route';
import { getServerSession } from 'next-auth';
import { getSheetCached } from '@/lib/googleSheets';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/googleSheets', () => ({
  getSheetCached: jest.fn(),
  appendRow: jest.fn(),
  updateRow: jest.fn(),
}));
jest.mock('@/lib/report', () => ({ normalizePhones: jest.fn(() => []) }));

const mockRows = {
  data: {
    values: [
      ['Cliente_ID','Organização - Nome','Negócio - Título','Negócio - Pessoa de contato','Pessoa - Cargo','Pessoa - Email - Work','Pessoa - Email - Home','Pessoa - Email - Other','Pessoa - Phone - Work','Pessoa - Phone - Home','Pessoa - Phone - Mobile','Pessoa - Phone - Other','Pessoa - Telefone','Pessoa - Celular','Telefone Normalizado','Organização - Segmento','Organização - Tamanho da empresa','uf','cidade_estimada','Status_Kanban','Data_Ultima_Movimentacao','Pessoa - End. Linkedin','Cor_Card'],
      ['1','Acme','Opp','Bob','CEO','a@a.com','','','','','','','','','','Tech','M','SP','Sao Paulo','Novo','2023-01-01','','red']
    ]
  }
};

describe('GET /api/clientes', () => {
  it('returns 401 when no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request('http://test.local/api/clientes'));
    expect(res.status).toBe(401);
  });

  it('returns clients when session exists', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'x' } });
    (getSheetCached as jest.Mock).mockResolvedValue(mockRows);
    const res = await GET(new Request('http://test.local/api/clientes'));
    const json = await res.json();
    expect(json.clients.length).toBe(1);
    expect(json.filters.segmento).toEqual(['Tech']);
  });
});
