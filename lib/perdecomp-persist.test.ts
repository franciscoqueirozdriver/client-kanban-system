/** @jest-environment node */
import crypto from 'crypto';

import * as persistModule from './perdecomp-persist';

const {
  __resetClienteIdSequenceForTests,
  __setResolveClienteIdOverrideForTests,
  loadSnapshotCard,
  resolveClienteId,
  savePerdecompResults,
} = persistModule;

const normalizeISO = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

jest.mock('./googleSheets', () => ({
  getSheetData: jest.fn(),
  getSheetsClient: jest.fn(),
  withRetry: jest.fn((fn: any) => fn()),
  chunk: jest.fn((rows: any[]) => [rows]),
}));

const { getSheetData, getSheetsClient, withRetry, chunk } = jest.requireMock('./googleSheets');

describe('perdecomp-persist', () => {
  const appendMock = jest.fn();
  const batchUpdateMock = jest.fn();
  const valuesUpdateMock = jest.fn();
  const spreadsheetsBatchUpdateMock = jest.fn();
  const spreadsheetsGetMock = jest.fn();
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:10:00.000Z'));
    __resetClienteIdSequenceForTests();
    getSheetData.mockReset();
    getSheetsClient.mockReset();
    withRetry.mockClear();
    chunk.mockClear();
    appendMock.mockReset();
    batchUpdateMock.mockReset();
    valuesUpdateMock.mockReset();
    spreadsheetsBatchUpdateMock.mockReset();
    spreadsheetsGetMock.mockReset();
    process.env.SPREADSHEET_ID = 'test-sheet-id';
    infoSpy.mockClear();
    errorSpy.mockClear();
    warnSpy.mockClear();
    getSheetsClient.mockResolvedValue({
      spreadsheets: {
        get: spreadsheetsGetMock,
        batchUpdate: spreadsheetsBatchUpdateMock,
        values: {
          append: appendMock,
          update: valuesUpdateMock,
          batchUpdate: batchUpdateMock,
        },
      },
    });
    spreadsheetsGetMock.mockResolvedValue({
      data: {
        sheets: [
          { properties: { title: 'perdecomp_snapshot' } },
          { properties: { title: 'perdecomp_facts' } },
        ],
      },
    });
    spreadsheetsBatchUpdateMock.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('resolveClienteId', () => {
    it('returns provided id when already compliant', async () => {
      await expect(
        resolveClienteId({ providedClienteId: 'CLT-1234', cnpj: '12345678000190' }),
      ).resolves.toBe('CLT-1234');
      expect(getSheetData).not.toHaveBeenCalled();
    });

    it('reuses snapshot id found by CNPJ', async () => {
      getSheetData.mockResolvedValueOnce({
        headers: ['cliente_id', 'cnpj'],
        rows: [
          { cliente_id: 'CLT-3683', cnpj: '12345678000190', _rowNumber: 2 },
          { cliente_id: 'CLT-1000', cnpj: '00990099009900', _rowNumber: 3 },
        ],
      });

      await expect(
        resolveClienteId({ providedClienteId: null, cnpj: '12345678000190' }),
      ).resolves.toBe('CLT-3683');
    });

    it('generates the next sequential id when none provided or found', async () => {
      const snapshotData = {
        headers: ['cliente_id', 'cnpj'],
        rows: [
          { cliente_id: 'CLT-3683', cnpj: '00990099009900', _rowNumber: 2 },
          { cliente_id: 'CLT-0100', cnpj: '11111111000111', _rowNumber: 3 },
        ],
      };
      getSheetData.mockResolvedValueOnce(snapshotData).mockResolvedValueOnce(snapshotData);

      await expect(resolveClienteId({ providedClienteId: 'COMP-9999', cnpj: '123' })).resolves.toBe(
        'CLT-3684',
      );
    });
  });

  it('persists snapshot with resolved clienteId and deduplicates facts', async () => {
    const snapshotHeaders = [
      'cliente_id',
      'empresa_id',
      'nome_da_empresa',
      'cnpj',
      'qtd_total',
      'qtd_dcomp',
      'qtd_rest',
      'qtd_ressarc',
      'risco_nivel',
      'risco_tags_json',
      'por_natureza_json',
      'por_credito_json',
      'datas_json',
      'primeira_data_iso',
      'ultima_data_iso',
      'resumo_ultima_consulta_json_p1',
      'resumo_ultima_consulta_json_p2',
      'card_schema_version',
      'rendered_at_iso',
      'fonte',
      'data_consulta',
      'url_comprovante_html',
      'payload_bytes',
      'snapshot_hash',
      'facts_count',
      'last_updated_iso',
      'consulta_id',
      'erro_ultima_consulta',
    ];
    const factsHeaders = [
      'cliente_id',
      'empresa_id',
      'nome_da_empresa',
      'cnpj',
      'perdcomp_numero',
      'perdcomp_formatado',
      'b1',
      'b2',
      'data_ddmmaa',
      'data_iso',
      'tipo_codigo',
      'tipo_nome',
      'natureza',
      'familia',
      'credito_codigo',
      'credito_descricao',
      'risco_nivel',
      'protocolo',
      'situacao',
      'situacao_detalhamento',
      'motivo_normalizado',
      'solicitante',
      'fonte',
      'data_consulta',
      'url_comprovante_html',
      'row_hash',
      'inserted_at',
      'consulta_id',
      'version',
      'deleted_flag',
    ];

    const meta = {
      fonte: 'api:infosimples',
      dataConsultaISO: '2024-01-01T11:00:00.000Z',
      urlComprovante: 'https://example.com',
      cardSchemaVersion: 'test-v1',
      renderedAtISO: '2024-01-01T12:00:00.000Z',
      consultaId: 'consulta-123',
    };

    const duplicatePerdcompNumero = '111112222201020311011234';
    const duplicatePerdcompISO = normalizeISO('2003-02-01');
    const duplicateFact = {
      cliente_id: 'COMP-1',
      empresa_id: '',
      cnpj: '12345678000190',
      perdcomp_numero: duplicatePerdcompNumero,
      natureza: '',
      credito_codigo: '',
      data_iso: '',
      valor: '0',
      tipo_codigo: '',
      tipo_nome: '',
      situacao: 'Em análise',
    };
    const duplicateHash = crypto
      .createHash('sha256')
      .update(
        [
          duplicatePerdcompNumero,
          '1',
          '1.1',
          '01',
          duplicatePerdcompISO,
          duplicateFact.valor,
        ].join('|'),
      )
      .digest('hex');

    const snapshotData = {
      headers: snapshotHeaders,
      rows: [
        { cliente_id: 'CLT-3683', cnpj: '00990099009900', _rowNumber: 2 },
        { cliente_id: 'CLT-0100', cnpj: '11111111000111', _rowNumber: 3 },
      ],
    };

    const snapshotRows = [...snapshotData.rows];

    getSheetData.mockImplementation((sheetName: string, range?: string) => {
      if (sheetName === persistModule.SHEET_SNAPSHOT) {
        return Promise.resolve({ headers: snapshotHeaders, rows: snapshotRows });
      }
      if (sheetName === persistModule.SHEET_FACTS) {
        if (range === 'A1:ZZ1') {
          return Promise.resolve({ headers: factsHeaders, rows: [] });
        }
        return Promise.resolve({
          headers: factsHeaders,
          rows: [
            {
              cliente_id: 'CLT-3684',
              perdcomp_numero: duplicateFact.perdcomp_numero,
              row_hash: duplicateHash,
              _rowNumber: 2,
            },
          ],
        });
      }
      throw new Error(`Unexpected sheet request: ${sheetName}`);
    });

    appendMock.mockImplementation((request) => {
      if (request.range === persistModule.SHEET_SNAPSHOT) {
        const values = request.requestBody.values[0];
        const newRow: any = { _rowNumber: snapshotRows.length + 2 };
        snapshotHeaders.forEach((header, index) => {
          newRow[header] = values[index] ?? '';
        });
        snapshotRows.push(newRow);
      }
      return Promise.resolve({});
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

    const newPerdcompNumero = '226629052425092513189471';
    const newPerdcompISO = normalizeISO('2025-09-25');

    const facts = [
      { ...duplicateFact },
      {
        cliente_id: 'COMP-1',
        empresa_id: '',
        cnpj: '12345678000190',
        perdcomp_numero: newPerdcompNumero,
        natureza: '',
        credito_codigo: '',
        data_iso: '',
        valor: '',
        tipo_codigo: '',
        tipo_nome: '',
      },
    ];

    await savePerdecompResults({
      clienteId: 'COMP-9999',
      empresaId: undefined,
      cnpj: '12345678000190',
      card,
      facts,
      meta,
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(spreadsheetsBatchUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          requests: expect.arrayContaining([
            expect.objectContaining({ addSheet: expect.anything() }),
          ]),
        }),
      }),
    );
    expect(valuesUpdateMock).not.toHaveBeenCalled();

    expect(appendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ range: persistModule.SHEET_FACTS }),
    );

    expect(appendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ range: persistModule.SHEET_SNAPSHOT }),
    );

    const snapshotAppendCall = appendMock.mock.calls[0][0];
    const factsAppendCall = appendMock.mock.calls[1][0];

    const snapshotValues = snapshotAppendCall.requestBody.values[0];
    const appendedFacts = factsAppendCall.requestBody.values;
    expect(snapshotValues[snapshotHeaders.indexOf('cliente_id')]).toBe('CLT-3684');
    expect(snapshotValues[snapshotHeaders.indexOf('cnpj')]).toBe('12345678000190');
    expect(snapshotValues[snapshotHeaders.indexOf('facts_count')]).toBe('2');
    expect(snapshotValues[snapshotHeaders.indexOf('risco_nivel')]).toBe('DESCONHECIDO');
    expect(
      JSON.parse(snapshotValues[snapshotHeaders.indexOf('risco_tags_json')]),
    ).toEqual([{ label: 'DESCONHECIDO', count: 2 }]);
    expect(appendedFacts).toHaveLength(1);
    const factRow = appendedFacts[0];
    expect(factRow[factsHeaders.indexOf('cliente_id')]).toBe('CLT-3684');
    expect(factRow[factsHeaders.indexOf('nome_da_empresa')]).toBe('Empresa Teste');
    expect(factRow[factsHeaders.indexOf('perdcomp_numero')]).toBe(newPerdcompNumero);
    expect(factRow[factsHeaders.indexOf('b1')]).toBe('');
    expect(factRow[factsHeaders.indexOf('b2')]).toBe('');
    expect(factRow[factsHeaders.indexOf('data_iso')]).toBe(newPerdcompISO);
    expect(factRow[factsHeaders.indexOf('data_ddmmaa')]).toBe('250925');
    expect(factRow[factsHeaders.indexOf('tipo_codigo')]).toBe('1');
    expect(factRow[factsHeaders.indexOf('tipo_nome')]).toBe('Declaração de Compensação');
    expect(factRow[factsHeaders.indexOf('natureza')]).toBe('1.3');
    expect(factRow[factsHeaders.indexOf('familia')]).toBe('DCOMP');
    expect(factRow[factsHeaders.indexOf('credito_codigo')]).toBe('18');
    expect(factRow[factsHeaders.indexOf('credito_descricao')]).toBe('Outros Créditos');
    expect(factRow[factsHeaders.indexOf('protocolo')]).toBe('9471');
    expect(factRow[factsHeaders.indexOf('row_hash')]).toBe(
      crypto
        .createHash('sha256')
        .update([newPerdcompNumero, '1', '1.3', '18', newPerdcompISO, ''].join('|'))
        .digest('hex'),
    );

    const porCredito = JSON.parse(
      snapshotValues[snapshotHeaders.indexOf('por_credito_json')],
    );
    expect(porCredito).toEqual([
      { label: 'Ressarcimento de IPI', count: 1 },
      { label: 'Outros Créditos', count: 1 },
    ]);

    expect(infoSpy).toHaveBeenCalledWith('PERSIST_START', {
      clienteId: 'CLT-3684',
      consultaId: meta.consultaId,
    });
    expect(infoSpy).toHaveBeenCalledWith('SNAPSHOT_OK', {
      clienteId: 'CLT-3684',
      snapshotHash: expect.any(String),
      factsCount: 2,
    });
    expect(infoSpy).toHaveBeenCalledWith('FACTS_OK', {
      clienteId: 'CLT-3684',
      inserted: 1,
      skipped: 1,
    });
    expect(infoSpy).toHaveBeenCalledWith('PERSIST_END', { clienteId: 'CLT-3684' });
    expect(errorSpy).not.toHaveBeenCalledWith('PERSIST_FAIL', expect.anything());

    const nowISO = new Date().toISOString();
    const batchCalls = batchUpdateMock.mock.calls.map((call) => call[0]);
    expect(batchCalls.length).toBeGreaterThan(0);
    const lastCall = batchCalls[batchCalls.length - 1];
    expect(lastCall.requestBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ values: [['2']] }),
        expect.objectContaining({ values: [['']] }),
        expect.objectContaining({ values: [[nowISO]] }),
      ]),
    );
  });

  it('marks snapshot error when persistence fails', async () => {
    const snapshotHeaders = ['cliente_id', 'erro_ultima_consulta', 'last_updated_iso'];

    appendMock.mockRejectedValueOnce(new Error('boom'));
    getSheetData
      .mockResolvedValueOnce({ headers: snapshotHeaders, rows: [] })
      .mockResolvedValueOnce({
        headers: snapshotHeaders,
        rows: [{ cliente_id: 'CLT-9000', _rowNumber: 2, erro_ultima_consulta: '', last_updated_iso: '' }],
      });

    await savePerdecompResults({
      clienteId: 'CLT-9000',
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
      clienteId: 'CLT-9000',
      message: 'boom',
    });
    expect(batchUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ valueInputOption: 'RAW' }),
      }),
    );
  });

  it('rejects invalid clienteId resolution', async () => {
    __setResolveClienteIdOverrideForTests(async () => 'COMP-9999');

    await expect(
      savePerdecompResults({
        clienteId: 'COMP-9999',
        empresaId: undefined,
        cnpj: undefined,
        card: {},
        facts: [],
        meta: { consultaId: 'consulta-789' },
      }),
    ).rejects.toThrow('Invalid cliente_id for persistence');

    expect(warnSpy).toHaveBeenCalledWith('PERSIST_ABORT_INVALID_CLIENTE_ID', {
      provided: 'COMP-9999',
      resolved: expect.any(String),
      cnpj: undefined,
    });
    __setResolveClienteIdOverrideForTests(null);
  });

  it('loads snapshot card by concatenating shards', async () => {
    getSheetData.mockImplementation((sheetName: string) => {
      if (sheetName === persistModule.SHEET_SNAPSHOT) {
        return Promise.resolve({
          headers: ['cliente_id', 'resumo_ultima_consulta_json_p1', 'resumo_ultima_consulta_json_p2'],
          rows: [
            {
              cliente_id: 'CLT-3683',
              resumo_ultima_consulta_json_p1: '{"nome":"Empresa"',
              resumo_ultima_consulta_json_p2: ',"valor":1}',
            },
          ],
        });
      }
      if (sheetName === persistModule.SHEET_FACTS) {
        return Promise.resolve({ headers: ['cliente_id'], rows: [] });
      }
      throw new Error(`Unexpected sheet request: ${sheetName}`);
    });

    const card = await loadSnapshotCard({ clienteId: 'CLT-3683' });
    expect(card).toEqual({ nome: 'Empresa', valor: 1, risk: { nivel: '', tags: [] }, agregados: { porCredito: [] } });
  });
});
