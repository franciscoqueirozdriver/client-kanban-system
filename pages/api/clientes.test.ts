/** @jest-environment node */
import handler from './clientes';
import { getSheetData } from '../../lib/googleSheets';

jest.mock('../../lib/googleSheets', () => ({
  getSheetData: jest.fn()
}));

describe('GET /api/clientes', () => {
  const header = [
    'Cliente_ID',
    'Nome da Empresa',
    'Negócio - Título',
    'Negócio - Pessoa de contato',
    'Pessoa - Cargo',
    'Pessoa - Email - Work',
    'Pessoa - Email - Home',
    'Pessoa - Email - Other',
    'Pessoa - Phone - Work',
    'Pessoa - Phone - Home',
    'Pessoa - Phone - Mobile',
    'Pessoa - Phone - Other',
    'Pessoa - Telefone',
    'Pessoa - Celular',
    'Telefone Normalizado',
    'Organização - Segmento',
    'Organização - Tamanho da empresa',
    'uf',
    'cidade_estimada',
    'Status_Kanban',
    'Data_Ultima_Movimentacao',
    'Pessoa - End. Linkedin',
    'Cor_Card'
  ];

  function makeRows(count: number) {
    return Array.from({ length: count }, (_, i) => {
      const row: Record<string, string> = {};
      header.forEach(key => row[key] = '');
      row['Cliente_ID'] = `id${i}`;
      row['Nome da Empresa'] = `Company ${i}`;
      return row;
    });
  }

  it('returns all clients', async () => {
    const rows = makeRows(1205);
    (getSheetData as jest.Mock).mockResolvedValue({ rows });

    const req = { method: 'GET', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toHaveLength(1205);
  });
});
