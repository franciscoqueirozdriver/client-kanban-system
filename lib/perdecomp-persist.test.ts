/** @jest-environment node */
import crypto from 'crypto';

import { loadSnapshotCard, savePerdecompResults } from './perdecomp-persist';

jest.mock('./googleSheets.js', () => ({
  getSheetData: jest.fn(),
  getSheetsClient: jest.fn(),
  withRetry: jest.fn((fn: any) => fn()),
  chunk: jest.fn((rows: any[]) => [rows]),
}));

const { getSheetData, getSheetsClient, withRetry, chunk } = jest.requireMock('./googleSheets.js');

describe('perdecomp-persist', () => {
  const appendMock = jest.fn();
  const batchUpdateMock = jest.fn();
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:10:00.000Z'));
    getSheetData.mockReset();
    getSheetsClient.mockReset();
    withRetry.mockClear();
    chunk.mockClear();
    appendMock.mockReset();
    batchUpdateMock.mockReset();
    infoSpy.mockClear();
    errorSpy.mockClear();
    getSheetsClient.mockResolvedValue({
      spreadsheets: {
        values: {
          append: appendMock,
          batchUpdate: batchUpdateMock,
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('persists snapshot and deduplicates facts', async () => {
    const snapshotHeaders = [
      'Cliente_ID',
      'Empresa_ID',
      'Nome da Empresa',
      'CNPJ',
      'Qtd_Total',
      'Qtd_DCOMP',
      'Qtd_REST',
      'Qtd_RESSARC',
      'Risco_Nivel',
      'Risco_Tags_JSON',
      'Por_Natureza_JSON',
      'Por_Credito_JSON',
      'Datas_JSON',
      'Primeira_Data_ISO',
      'Ultima_Data_ISO',
      'Resumo_Ultima_Consulta_JSON_P1',
      'Resumo_Ultima_Consulta_JSON_P2',
      'Card_Schema_Version',
      'Rendered_At_ISO',
      'Fonte',
      'Data_Consulta',
      'URL_Comprovante_HTML',
      'Payload_Bytes',
      'Last_Updated_ISO',
      'Snapshot_Hash',
      'Facts_Count',
      'Consulta_ID',
      'Erro_Ultima_Consulta',
    ];
    const factsHeaders = [
      'Cliente_ID',
      'Perdcomp_Numero',
      'Natureza',
      'Credito',
      'Data_Consulta',
      'Fonte',
      'Row_Hash',
      'Consulta_ID',
      'Inserted_At',
    ];

    const meta = {
      fonte: 'api:infosimples',
      dataConsultaISO: '2024-01-01T11:00:00.000Z',
      urlComprovante: 'https://example.com',
      cardSchemaVersion: 'test-v1',
      renderedAtISO: '2024-01-01T12:00:00.000Z',
      consultaId: 'consulta-123',
    };

    const duplicateFact = {
      Cliente_ID: 'cli-1',
      Empresa_ID: '',
      CNPJ: '12345678000190',
      Perdcomp_Numero: '123451234512345123451234',
      Natureza: '1.3',
      Credito: '01',
      Data_Consulta: meta.dataConsultaISO,
      Fonte: meta.fonte,
    };
    const serializedDuplicate = Object.entries(duplicateFact)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('|');
    const duplicateHash = crypto.createHash('sha256').update(serializedDuplicate).digest('hex');

    getSheetData
      .mockResolvedValueOnce({ headers: snapshotHeaders, rows: [] })
      .mockResolvedValueOnce({
        headers: factsHeaders,
        rows: [
          {
            Cliente_ID: 'cli-1',
            Perdcomp_Numero: duplicateFact.Perdcomp_Numero,
            Natureza: duplicateFact.Natureza,
            Credito: duplicateFact.Credito,
            Data_Consulta: duplicateFact.Data_Consulta,
            Fonte: duplicateFact.Fonte,
            Row_Hash: duplicateHash,
            _rowNumber: 2,
          },
        ],
      });

    const card = {
      nomeEmpresa: 'Empresa Teste',
      perdcompResumo: {
        total: 2,
        totalSemCancelamento: 2,
        canc: 0,
        porFamilia: { DCOMP: 1, REST: 1, RESSARC: 0, CANC: 0, DESCONHECIDO: 0 },
        porNaturezaAgrupada: { '1.3/1.7': 1, '1.2/1.6': 1 },
      },
      perdcompCodigos: ['123451234512345123451234', '987659876598765987659876'],
    };

    const facts = [
      { ...duplicateFact },
      {
        Cliente_ID: 'cli-1',
        Empresa_ID: '',
        CNPJ: '12345678000190',
        Perdcomp_Numero: '987659876598765987659876',
        Natureza: '1.2',
        Credito: '02',
      },
    ];

    await savePerdecompResults({
      clienteId: 'cli-1',
      empresaId: undefined,
      cnpj: '12345678000190',
      card,
      facts,
      meta,
    });

    expect(appendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ range: 'perdecomp_snapshot' }),
    );
    expect(appendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ range: 'perdecomp_facts' }),
    );
    const appendedFacts = appendMock.mock.calls[1][0].requestBody.values;
    expect(appendedFacts).toHaveLength(1);
    expect(appendedFacts[0][factsHeaders.indexOf('Perdcomp_Numero')]).toBe('987659876598765987659876');
    expect(infoSpy).toHaveBeenCalledWith('FACTS_OK', {
      clienteId: 'cli-1',
      inserted: 1,
      skipped: 1,
    });
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('PERSIST_FAIL'), expect.anything());
  });

  it('marks snapshot error when persistence fails', async () => {
    const snapshotHeaders = ['Cliente_ID', 'Erro_Ultima_Consulta', 'Last_Updated_ISO'];

    appendMock.mockRejectedValueOnce(new Error('boom'));
    getSheetData
      .mockResolvedValueOnce({ headers: snapshotHeaders, rows: [] })
      .mockResolvedValueOnce({ headers: snapshotHeaders, rows: [{ Cliente_ID: 'cli-1', _rowNumber: 2 }] });

    await savePerdecompResults({
      clienteId: 'cli-1',
      empresaId: undefined,
      cnpj: '12345678000190',
      card: { nomeEmpresa: 'Empresa Teste' },
      facts: [],
      meta: {
        fonte: 'api:infosimples',
        dataConsultaISO: '2024-01-01T11:00:00.000Z',
        urlComprovante: '',
        cardSchemaVersion: 'test',
        renderedAtISO: '2024-01-01T12:00:00.000Z',
        consultaId: 'consulta-456',
      },
    });

    expect(errorSpy).toHaveBeenCalledWith('PERSIST_FAIL', {
      clienteId: 'cli-1',
      message: 'boom',
    });
    expect(batchUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ valueInputOption: 'RAW' }),
      }),
    );
  });

  it('loads snapshot card by concatenating shards', async () => {
    getSheetData.mockResolvedValueOnce({
      headers: ['Cliente_ID', 'Resumo_Ultima_Consulta_JSON_P1', 'Resumo_Ultima_Consulta_JSON_P2'],
      rows: [
        {
          Cliente_ID: 'cli-1',
          Resumo_Ultima_Consulta_JSON_P1: '{"nome":"Empresa"',
          Resumo_Ultima_Consulta_JSON_P2: ',"valor":1}',
        },
      ],
    });

    const card = await loadSnapshotCard({ clienteId: 'cli-1' });
    expect(card).toEqual({ nome: 'Empresa', valor: 1 });
  });
});

