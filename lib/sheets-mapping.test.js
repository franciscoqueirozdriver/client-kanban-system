import { getColumnMapping, mapSheetRowToSnakeObject } from './sheets-mapping';
import mapping from '../config/planilha_mapping.json';

jest.mock('../config/planilha_mapping.json', () => ({
    "tabs": {
        "sheet1": "sheet1",
        "TestSheet": "test_sheet"
    },
    "columns": {
        "sheet1": {
            "Cliente_ID": "cliente_id",
            "Nome do Lead": "nome_do_lead",
            "CPF/CNPJ": "cpf_cnpj"
        },
        "test_sheet": {
            "Header 1": "header_1",
            "Header 2": "header_2"
        }
    }
}));

describe('sheets-mapping', () => {
    describe('mapSheetRowToSnakeObject', () => {
        it('should correctly map a row to a snake_case object', () => {
            const sheetName = 'sheet1';
            const headers = ['Cliente_ID', 'Nome do Lead', 'CPF/CNPJ'];
            const row = ['CLT-1234', 'Test Lead', '12345678000190'];
            const result = mapSheetRowToSnakeObject(sheetName, headers, row);
            expect(result).toEqual({
                cliente_id: 'CLT-1234',
                nome_do_lead: 'Test Lead',
                cpf_cnpj: '12345678000190'
            });
        });

        it('should ignore columns that are not in the mapping', () => {
            const sheetName = 'sheet1';
            const headers = ['Cliente_ID', 'Nome do Lead', 'Extra Column'];
            const row = ['CLT-1234', 'Test Lead', 'extra data'];
            const result = mapSheetRowToSnakeObject(sheetName, headers, row);
            expect(result).toEqual({
                cliente_id: 'CLT-1234',
                nome_do_lead: 'Test Lead'
            });
        });

        it('should handle an empty row', () => {
            const sheetName = 'sheet1';
            const headers = ['Cliente_ID', 'Nome do Lead', 'CPF/CNPJ'];
            const row = [];
            const result = mapSheetRowToSnakeObject(sheetName, headers, row);
            expect(result).toEqual({});
        });
    });
});
