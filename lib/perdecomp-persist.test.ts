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
        headers: ['Cliente_ID', 'CNPJ'],
        rows: [
          { Cliente_ID: 'CLT-3683', CNPJ: '12345678000190', _rowNumber: 2 },
          { Cliente_ID: 'CLT-1000', CNPJ: '00990099009900', _rowNumber: 3 },
        ],
      });

      await expect(
        resolveClienteId({ providedClienteId: null, cnpj: '12345678000190' }),
      ).resolves.toBe('CLT-3683');
    });

    it('generates the next sequential id when none provided or found', async () => {
      const snapshotData = {
        headers: ['Cliente_ID', 'CNPJ'],
        rows: [
          { Cliente_ID: 'CLT-3683', CNPJ: '00990099009900', _rowNumber: 2 },
          { Cliente_ID: 'CLT-0100', CNPJ: '11111111000111', _rowNumber: 3 },
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
      'Snapshot_Hash',
      'Facts_Count',
      'Last_Updated_ISO',
      'Consulta_ID',
      'Erro_Ultima_Consulta',
    ];
    const factsHeaders = [
      'Cliente_ID',
      'Empresa_ID',
      'Nome da Empresa',
      'CNPJ',
      'Perdcomp_Numero',
      'Perdcomp_Formatado',
      'B1',
      'B2',
      'Data_DDMMAA',
      'Data_ISO',
      'Tipo_Codigo',
      'Tipo_Nome',
      'Natureza',
      'Familia',
      'Credito_Codigo',
      'Credito_Descricao',
      'Risco_Nivel',
      'Protocolo',
      'Situacao',
      'Situacao_Detalhamento',
      'Motivo_Normalizado',
      'Solicitante',
      'Fonte',
      'Data_Consulta',
      'URL_Comprovante_HTML',
      'Row_Hash',
      'Inserted_At',
      'Consulta_ID',
      'Version',
      'Deleted_Flag',
    ];

    const meta = {
      fonte: 'api:infosimples',
      dataConsultaISO: '2024-01-01T11:00:00.000Z',
      urlComprovante: 'https://example.com',
      cardSchemaVersion: 'test-v1',
      renderedAtISO: '2024-01-01T12:00:00.000Z',
      consultaId: 'consulta-123',
    };
    const nowISO = new Date().toISOString();

    const duplicatePerdcompNumero = '111112222201020311011234';
    const duplicatePerdcompISO = normalizeISO('2003-02-01');
    const duplicateFact = {
      Cliente_ID: 'COMP-1',
      Empresa_ID: '',
      CNPJ: '00001234567890',
      Perdcomp_Numero: duplicatePerdcompNumero,
      Natureza: '',
      Credito_Codigo: '',
      Data_ISO: '',
      Valor: '0',
      Tipo_Codigo: '',
      Tipo_Nome: '',
      Situacao: 'Em análise',
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
          duplicateFact.Valor,
        ].join('|'),
      )
      .digest('hex');

    const snapshotData = {
      headers: snapshotHeaders,
      rows: [
        { Cliente_ID: 'CLT-3683', CNPJ: '00990099009900', _rowNumber: 2 },
        { Cliente_ID: 'CLT-0100', CNPJ: '11111111000111', _rowNumber: 3 },
      ],
    };

    const snapshotRows = [...snapshotData.rows];

    getSheetData.mockImplementation((sheetName: string, range?: string) => {
      if (sheetName === 'perdecomp_snapshot') {
        return Promise.resolve({ headers: snapshotHeaders, rows: snapshotRows });
      }
      if (sheetName === 'perdecomp_facts') {
        if (range === 'A1:ZZ1') {
          return Promise.resolve({ headers: factsHeaders, rows: [] });
        }
        return Promise.resolve({
          headers: factsHeaders,
          rows: [
            {
              Cliente_ID: 'CLT-3684',
              Perdcomp_Numero: duplicateFact.Perdcomp_Numero,
              Row_Hash: duplicateHash,
              _rowNumber: 2,
            },
          ],
        });
      }
      if (sheetName === 'DIC_CREDITOS') {
        return Promise.resolve({
          headers: ['Credito_Codigo', 'Credito_Descricao', 'Ativo', 'Criado_Em_ISO'],
          rows: [
            {
              Credito_Codigo: '01',
              Credito_Descricao: 'Crédito Existente',
              Ativo: '1',
              Criado_Em_ISO: '2023-01-01T00:00:00.000Z',
            },
          ],
        });
      }
      if (sheetName === 'DIC_NATUREZA') {
        return Promise.resolve({
          headers: ['Natureza', 'Familia', 'Tipo_Codigo', 'Tipo_Nome', 'Ativo', 'Criado_Em_ISO'],
          rows: [],
        });
      }
      throw new Error(`Unexpected sheet request: ${sheetName}`);
    });

    appendMock.mockImplementation((request) => {
      if (request.range === 'perdecomp_snapshot') {
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
        Cliente_ID: 'COMP-1',
        Empresa_ID: '',
        CNPJ: '00001234567890',
        Perdcomp_Numero: newPerdcompNumero,
        Natureza: '',
        Credito_Codigo: '',
        Data_ISO: '',
        Valor: '',
        Tipo_Codigo: '',
        Tipo_Nome: '',
      },
    ];

    await savePerdecompResults({
      clienteId: 'COMP-9999',
      empresaId: undefined,
      cnpj: '00001234567890',
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

    const appendRanges = appendMock.mock.calls.map((call) => call[0].range);
    expect(appendRanges).toEqual([
      'perdecomp_facts',
      'DIC_CREDITOS',
      'DIC_NATUREZA',
      'perdecomp_snapshot',
    ]);

    const snapshotAppendCall = appendMock.mock.calls.find(
      ([request]) => request.range === 'perdecomp_snapshot',
    )?.[0];
    const factsAppendCall = appendMock.mock.calls.find(
      ([request]) => request.range === 'perdecomp_facts',
    )?.[0];
    const dicCreditoAppendCall = appendMock.mock.calls.find(
      ([request]) => request.range === 'DIC_CREDITOS',
    )?.[0];
    const dicNaturezaAppendCall = appendMock.mock.calls.find(
      ([request]) => request.range === 'DIC_NATUREZA',
    )?.[0];

    expect(snapshotAppendCall).toBeDefined();
    expect(factsAppendCall).toBeDefined();
    expect(dicCreditoAppendCall).toBeDefined();
    expect(dicNaturezaAppendCall).toBeDefined();

    const snapshotValues = snapshotAppendCall!.requestBody.values[0];
    const appendedFacts = factsAppendCall!.requestBody.values;
    expect(snapshotValues[snapshotHeaders.indexOf('Cliente_ID')]).toBe('CLT-3684');
    expect(snapshotValues[snapshotHeaders.indexOf('CNPJ')]).toBe('00001234567890');
    expect(snapshotValues[snapshotHeaders.indexOf('Facts_Count')]).toBe('2');
    expect(snapshotValues[snapshotHeaders.indexOf('Risco_Nivel')]).toBe('DESCONHECIDO');
    expect(
      JSON.parse(snapshotValues[snapshotHeaders.indexOf('Risco_Tags_JSON')]),
    ).toEqual([{ label: 'DESCONHECIDO', count: 2 }]);
    expect(appendedFacts).toHaveLength(1);
    const factRow = appendedFacts[0];
    expect(factRow[factsHeaders.indexOf('Cliente_ID')]).toBe('CLT-3684');
    expect(factRow[factsHeaders.indexOf('Nome da Empresa')]).toBe('Empresa Teste');
    expect(factRow[factsHeaders.indexOf('Perdcomp_Numero')]).toBe(newPerdcompNumero);
    expect(factRow[factsHeaders.indexOf('B1')]).toBe('');
    expect(factRow[factsHeaders.indexOf('B2')]).toBe('');
    expect(factRow[factsHeaders.indexOf('Data_ISO')]).toBe(newPerdcompISO);
    expect(factRow[factsHeaders.indexOf('Data_DDMMAA')]).toBe('250925');
    expect(factRow[factsHeaders.indexOf('Tipo_Codigo')]).toBe('1');
    expect(factRow[factsHeaders.indexOf('Tipo_Nome')]).toBe('Declaração de Compensação');
    expect(factRow[factsHeaders.indexOf('Natureza')]).toBe('1.3');
    expect(factRow[factsHeaders.indexOf('Familia')]).toBe('DCOMP');
    expect(factRow[factsHeaders.indexOf('Credito_Codigo')]).toBe('18');
    expect(factRow[factsHeaders.indexOf('Credito_Descricao')]).toBe('Outros Créditos');
    expect(factRow[factsHeaders.indexOf('Protocolo')]).toBe('9471');
    expect(factRow[factsHeaders.indexOf('Row_Hash')]).toBe(
      crypto
        .createHash('sha256')
        .update([newPerdcompNumero, '1', '1.3', '18', newPerdcompISO, ''].join('|'))
        .digest('hex'),
    );

    const dicCreditoValues = dicCreditoAppendCall!.requestBody.values;
    expect(dicCreditoValues).toEqual([['18', 'Outros Créditos', '1', nowISO]]);
    const dicNaturezaValues = dicNaturezaAppendCall!.requestBody.values;
    expect(dicNaturezaValues).toEqual([
      ['1.3', 'DCOMP', '1', 'Declaração de Compensação', '1', nowISO],
    ]);

    const porCredito = JSON.parse(
      snapshotValues[snapshotHeaders.indexOf('Por_Credito_JSON')],
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
    expect(infoSpy).toHaveBeenCalledWith('DIC_UPSERT_OK', {
      clienteId: 'CLT-3684',
      creditosAdded: 1,
      naturezasAdded: 1,
    });
    expect(infoSpy).toHaveBeenCalledWith('FACTS_OK', {
      clienteId: 'CLT-3684',
      inserted: 1,
      skipped: 1,
    });
    expect(infoSpy).toHaveBeenCalledWith(
      'PERSIST_END',
      expect.objectContaining({
        clienteId: 'CLT-3684',
        factsInserted: 1,
        factsSkipped: 1,
        factsError: null,
        snapshotError: null,
      }),
    );
    expect(errorSpy).not.toHaveBeenCalledWith('PERSIST_FAIL', expect.anything());

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
    const snapshotHeaders = ['Cliente_ID', 'Erro_Ultima_Consulta', 'Last_Updated_ISO'];

    appendMock.mockRejectedValueOnce(new Error('boom'));
    getSheetData
      .mockResolvedValueOnce({ headers: snapshotHeaders, rows: [] })
      .mockResolvedValueOnce({
        headers: snapshotHeaders,
        rows: [{ Cliente_ID: 'CLT-9000', _rowNumber: 2, Erro_Ultima_Consulta: '', Last_Updated_ISO: '' }],
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

    expect(warnSpy).toHaveBeenCalledWith('SNAPSHOT_FAIL_SOFT', {
      clienteId: 'CLT-9000',
      message: 'boom',
    });
    expect(errorSpy).not.toHaveBeenCalledWith('PERSIST_FAIL', expect.anything());
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
    ).rejects.toThrow('Invalid Cliente_ID for persistence');

    expect(warnSpy).toHaveBeenCalledWith('PERSIST_ABORT_INVALID_CLIENTE_ID', {
      provided: 'COMP-9999',
      resolved: expect.any(String),
      cnpj: '',
    });
    __setResolveClienteIdOverrideForTests(null);
  });

  it('loads snapshot card by concatenating shards', async () => {
    getSheetData.mockImplementation((sheetName: string) => {
      if (sheetName === 'perdecomp_snapshot') {
        return Promise.resolve({
          headers: ['Cliente_ID', 'Resumo_Ultima_Consulta_JSON_P1', 'Resumo_Ultima_Consulta_JSON_P2'],
          rows: [
            {
              Cliente_ID: 'CLT-3683',
              Resumo_Ultima_Consulta_JSON_P1: '{"nome":"Empresa"',
              Resumo_Ultima_Consulta_JSON_P2: ',"valor":1}',
            },
          ],
        });
      }
      if (sheetName === 'perdecomp_facts') {
        return Promise.resolve({ headers: ['Cliente_ID'], rows: [] });
      }
      throw new Error(`Unexpected sheet request: ${sheetName}`);
    });

    const card = await loadSnapshotCard({ clienteId: 'CLT-3683' });
    expect(card).toEqual({ nome: 'Empresa', valor: 1, risk: { nivel: '', tags: [] }, agregados: { porCredito: [] } });
  });
});
