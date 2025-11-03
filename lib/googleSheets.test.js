/** @jest-environment node */
const batchUpdateMock = jest.fn().mockResolvedValue({});
const valuesGetMock = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn(() => ({ authorize: jest.fn().mockResolvedValue(true) })),
    },
    options: jest.fn(),
    sheets: jest.fn(() => ({
      spreadsheets: { values: { get: valuesGetMock, batchUpdate: batchUpdateMock } },
    })),
  },
}));

const gs = require('./googleSheets');

describe('findRowIndexById', () => {
  beforeEach(() => {
    process.env.SPREADSHEET_ID = 'sheet';
    process.env.GOOGLE_CLIENT_EMAIL = 'a';
    process.env.GOOGLE_PRIVATE_KEY = 'b';
    valuesGetMock.mockReset();
  });

  it('finds ID beyond 1000', async () => {
    const values = [
      ['id'],
      ...Array.from({ length: 1001 }, (_, i) => [String(i + 1)]),
    ];
    valuesGetMock.mockResolvedValueOnce({ data: { values } });
    const idx = await gs.findRowIndexById('sheet1', 1, 'id', '1001');
    expect(idx).toBe(1002);
  });
});

describe('updateRowByIndex', () => {
  beforeEach(() => {
    process.env.SPREADSHEET_ID = 'sheet';
    process.env.GOOGLE_CLIENT_EMAIL = 'a';
    process.env.GOOGLE_PRIVATE_KEY = 'b';
    valuesGetMock.mockReset();
    batchUpdateMock.mockClear();
  });

  it('updates correct ranges', async () => {
    const values = [
      ['id', 'status_kanban', 'cor_card'],
      ['1', '', ''],
      ['2', '', ''],
      ['3', '', ''],
      ['4', '', ''],
      ['5', '', ''],
    ];
    valuesGetMock.mockResolvedValueOnce({ data: { values } });
    await gs.updateRowByIndex({
      sheetName: 'sheet1',
      rowIndex: 5,
      updates: { status_kanban: 'Lead Selecionado', cor_card: 'green' },
    });
    expect(batchUpdateMock).toHaveBeenCalledWith({
      spreadsheetId: 'sheet',
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: 'Status_Kanban!B5:B5',
            values: [['Lead Selecionado']],
          },
          { range: 'Cor_Card!C5:C5', values: [['green']] },
        ],
      },
    });
  });
});

