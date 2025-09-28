import { google, sheets_v4 } from 'googleapis';
import https from 'https';
import {
  normalizeCnpj as canonicalNormalizeCnpj,
  nextClienteId as canonicalNextClienteId,
  isValidCnpjPattern,
} from './normalizers';

// --- Type Definitions ---
interface SheetRow {
  _rowNumber: number;
  [key: string]: any;
}

interface SheetData {
  headers: string[];
  rows: SheetRow[];
}

interface UpdateRowPayload {
  sheetName: string;
  rowIndex: number;
  updates: Record<string, any>;
}

// --- Cache & Auth ---

const readCache = new Map<string, { time: number; data: any }>();
let sheetsClientPromise: Promise<sheets_v4.Sheets> | undefined;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

      if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        const msg = 'GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY is not set.';
        console.error(msg);
        throw new Error(msg);
      }

      const auth = new google.auth.JWT({
        email: GOOGLE_CLIENT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const httpAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

      google.options({ auth, httpAgent } as any);

      await auth.authorize();

      return google.sheets({ version: 'v4' });
    })();
  }
  return sheetsClientPromise;
}

// --- Helper Functions ---

export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
    let attempt = 0;
    let lastErr: any;
    while (attempt < tries) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const status = err?.code || err?.response?.status || 0;
            const transient = [429, 500, 502, 503, 504];
            if (!transient.includes(status) || attempt === tries - 1) {
                throw err;
            }
            const delay = Math.pow(2, attempt) * 500 + Math.random() * 1000;
            await new Promise((r) => setTimeout(r, delay));
            attempt++;
        }
    }
    throw lastErr;
}

export function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

function normalizeText(str: string | null | undefined): string {
    return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeUF(uf: string | null | undefined): string {
  if (!uf) return '';
  const map: Record<string, string> = { AC:'AC',AL:'AL',AP:'AP',AM:'AM',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MT:'MT',MS:'MS',MG:'MG',PA:'PA',PB:'PB',PR:'PR',PE:'PE',PI:'PI',RJ:'RJ',RN:'RN',RS:'RS',RO:'RO',RR:'RR',SC:'SC',SP:'SP',SE:'SE',TO:'TO',ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA:'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO' };
  const cleaned = normalizeText(uf).toUpperCase();
  return map[cleaned] || '';
}

function normalizePhoneNumber(phone: string = '', ddi: string = ''): string {
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    const ddiDigits = ddi.replace(/\D/g, '');

    if (ddiDigits && !digits.startsWith(ddiDigits)) {
        digits = `${ddiDigits}${digits}`;
    }
    if (!digits.startsWith('+')) {
        digits = `+${digits}`;
    }
    return digits;
}

function distributeContactPhones(phonesString: string = ''): Record<string, string> {
    const phones = phonesString.split(';').map(p => p.trim()).filter(Boolean);
    return {
        Work: phones[0] || '',
        Mobile: phones[1] || '',
        Home: phones[2] || '',
        Other: phones[3] || '',
    };
}

function isValidEmail(email: string = ''): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function columnNumberToLetter(columnNumber: number): string {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

// --- Generic Sheet Interaction ---

export async function getSheetData(sheetName: string, range = 'A:ZZ', spreadsheetId: string = process.env.SPREADSHEET_ID!): Promise<SheetData> {
    const key = `sheetData:${sheetName}:${range}`;
    const cached = readCache.get(key);
    if (cached && Date.now() - cached.time < 10000) {
        return cached.data;
    }

    const sheets = await getSheetsClient();
    const res = await withRetry(() =>
        sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!${range}`,
        })
    );
    const rows = res.data.values || [];
    if (rows.length === 0) return { headers: [], rows: [] };

    const rawHeaders = rows[0];
    const headers = rawHeaders.map((h: any) => (h || '').toString().trim());

    const data = rows.slice(1).map((row: any[], idx: number) => {
        const obj: SheetRow = { _rowNumber: idx + 2 };
        headers.forEach((h: string, i: number) => {
            if (h) obj[h] = row[i] ?? '';
        });
        return obj;
    });

    const result = { headers, rows: data };
    readCache.set(key, { time: Date.now(), data: result });
    return result;
}

// --- Row Builders with Normalization ---

function buildLeadsExactSpotterRow(payload: any): any[] {
    const { Empresa, Contato, Comercial } = payload;
    const columnOrder = [
        'Cliente_ID', 'Nome do Lead', 'Origem', 'Sub-Origem', 'Mercado', 'Produto', 'Site', 'País', 'Estado', 'Cidade',
        'Logradouro', 'Número', 'Bairro', 'Complemento', 'CEP', 'DDI', 'Telefones', 'Observação', 'CPF/CNPJ',
        'Nome Contato', 'E-mail Contato', 'Cargo Contato', 'DDI Contato', 'Telefones Contato',
        'Tipo do Serv. Comunicação', 'ID do Serv. Comunicação', 'Área', 'Nome da Empresa', 'Etapa', 'Funil'
    ];

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome do Lead': return Empresa.Nome_da_Empresa;
            case 'Origem': return Comercial.Origem;
            case 'Sub-Origem': return Comercial.Sub_Origem;
            case 'Mercado': return Comercial.Mercado;
            case 'Produto': return Comercial.Produto;
            case 'Site': return Empresa.Site_Empresa;
            case 'País': return Empresa.País_Empresa;
            case 'Estado': return Empresa.Estado_Empresa;
            case 'Cidade': return Empresa.Cidade_Empresa;
            case 'Logradouro': return Empresa.Logradouro_Empresa;
            case 'Número': return Empresa.Numero_Empresa;
            case 'Bairro': return Empresa.Bairro_Empresa;
            case 'Complemento': return Empresa.Complemento_Empresa;
            case 'CEP': return Empresa.CEP_Empresa;
            case 'DDI': return Empresa.DDI_Empresa;
            case 'Telefones': return Empresa.Telefones_Empresa;
            case 'Observação': return Empresa.Observacao_Empresa;
            case 'CPF/CNPJ': return canonicalNormalizeCnpj(Empresa.CNPJ_Empresa);
            case 'Nome Contato': return Contato.Nome_Contato;
            case 'E-mail Contato': return Contato.Email_Contato;
            case 'Cargo Contato': return Contato.Cargo_Contato;
            case 'DDI Contato': return Contato.DDI_Contato;
            case 'Telefones Contato': return Contato.Telefones_Contato;
            case 'Tipo do Serv. Comunicação': return Comercial.Tipo_do_Serv_Comunicacao;
            case 'ID do Serv. Comunicação': return Comercial.ID_do_Serv_Comunicacao;
            case 'Área': return Comercial.Área;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Etapa': return Comercial.Etapa;
            case 'Funil': return Comercial.Funil;
            default: return '';
        }
    });
}

function buildLayoutImportacaoRow(payload: any): any[] {
    const { Empresa } = payload;
    const columnOrder = [
        'Cliente_ID', 'Nome da Empresa', 'Site Empresa', 'País Empresa', 'Estado Empresa', 'Cidade Empresa',
        'Logradouro Empresa', 'Numero Empresa', 'Bairro Empresa', 'Complemento Empresa', 'CEP Empresa',
        'CNPJ Empresa', 'DDI Empresa', 'Telefones Empresa', 'Observação Empresa'
    ];

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome da Empresa': return Empresa.Nome_da_Empresa;
            case 'Site Empresa': return Empresa.Site_Empresa;
            case 'País Empresa': return Empresa.País_Empresa;
            case 'Estado Empresa': return Empresa.Estado_Empresa;
            case 'Cidade Empresa': return Empresa.Cidade_Empresa;
            case 'Logradouro Empresa': return Empresa.Logradouro_Empresa;
            case 'Numero Empresa': return Empresa.Numero_Empresa;
            case 'Bairro Empresa': return Empresa.Bairro_Empresa;
            case 'Complemento Empresa': return Empresa.Complemento_Empresa;
            case 'CEP Empresa': return Empresa.CEP_Empresa;
            case 'CNPJ Empresa': return canonicalNormalizeCnpj(Empresa.CNPJ_Empresa);
            case 'DDI Empresa': return Empresa.DDI_Empresa;
            case 'Telefones Empresa': return Empresa.Telefones_Empresa;
            case 'Observação Empresa': return Empresa.Observacao_Empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload: any): any[] {
    const { Empresa, Contato, Comercial } = payload;
    const contactPhones = distributeContactPhones(Contato.Telefones_Contato);

    const columnOrder = [
        'Negócio - Título', 'Negócio - Valor', 'Negócio - Organização', 'Negócio - Pessoa de contato', 'Negócio - Data de fechamento esperada', 'Negócio - Data da próxima atividade', 'Negócio - Proprietário', 'Negócio - Etapa', 'Negócio - Fonte do Lead', 'Negócio - Qualificação Lead (Closer)', 'Negócio - Qualificação do Lead (SDR)', 'Negócio - Motivo da perda', 'Negócio - Data de criação do negócio', 'Negócio - SDR Responsável', 'Negócio - Ganho em', 'Negócio - Data de perda', 'Negócio - VLR Mensalidade', 'Negócio - VLR Implantação', 'Negócio - Ranking', 'Negócio - Negócio fechado em', 'Negócio - [Closer] Lead é o Decisor?', 'Negócio - Atividades concluídas', 'Negócio - Atividades para fazer', 'Negócio - Criador', 'Negócio - Data atualizada', 'Negócio - Data da última atividade', 'Negócio - Etiqueta', 'Negócio - Funil', 'Negócio - Moeda de VLR Mensalidade', 'Negócio - Moeda de VLR Implantação', 'Negócio - Canal de origem', 'Negócio - MRR', 'Negócio - Valor de produtos', 'Negócio - Valor ponderado', 'Negócio - Moeda', 'Negócio - ID', 'Negócio - ID de origem', 'Negócio - ID do canal de origem', 'Negócio - Nome do produto', 'Negócio - Número de mensagens de e-mail', 'Negócio - Origem', 'Negócio - Probabilidade', 'Negócio - ACV', 'Negócio - ARR', 'Negócio - Quantidade de produtos', 'Negócio - Telefone do Closer', 'Negócio - Tempo de Implantação', 'Negócio - Total de atividades', 'Negócio - UTM CAMPAIGN', 'Negócio - UTM CONTENT', 'Negócio - UTM MEDIUM', 'Negócio - UTM_SOURCE', 'Negócio - UTM_TERM', 'Negócio - Visível para', 'Negócio - Última alteração de etapa', 'Negócio - Último e-mail enviado', 'Negócio - Último e-mail recebido', 'Pessoa - Cargo', 'Pessoa - Email - Work', 'Pessoa - Email - Home', 'Pessoa - Email - Other', 'Pessoa - End. Linkedin', 'Pessoa - Phone - Work', 'Pessoa - Phone - Home', 'Pessoa - Phone - Mobile', 'Pessoa - Phone - Other', 'Pessoa - Telefone', 'Pessoa - Celular', 'Organização - Nome', 'Organização - Segmento', 'Organização - Tamanho da empresa', 'Negócio - Status', 'ddd', 'uf', 'cidade_estimada', 'fonte_localizacao', 'Status_Kanban', 'Cor_Card', 'Data_Ultima_Movimentacao', 'Impresso_Lista', 'Telefone Normalizado', 'Cliente_ID'
    ];

    const rowData: Record<string, any> = {
        'Cliente_ID': payload.Cliente_ID,
        'Negócio - Título': Empresa.Nome_da_Empresa,
        'Negócio - Organização': Empresa.Nome_da_Empresa,
        'Organização - Nome': Empresa.Nome_da_Empresa,
        'Negócio - Pessoa de contato': Contato.Nome_Contato,
        'Pessoa - Cargo': Contato.Cargo_Contato,
        'Pessoa - Email - Work': isValidEmail(Contato.Email_Contato) ? Contato.Email_Contato : '',
        'Pessoa - Phone - Work': normalizePhoneNumber(contactPhones.Work, Contato.DDI_Contato),
        'Pessoa - Phone - Home': normalizePhoneNumber(contactPhones.Home, Contato.DDI_Contato),
        'Pessoa - Phone - Mobile': normalizePhoneNumber(contactPhones.Mobile, Contato.DDI_Contato),
        'Pessoa - Phone - Other': normalizePhoneNumber(contactPhones.Other, Contato.DDI_Contato),
        'Pessoa - Telefone': Contato.Telefones_Contato,
        'Organização - Segmento': Comercial.Mercado,
        'Negócio - Nome do produto': Comercial.Produto,
        'uf': normalizeUF(Empresa.Estado_Empresa),
        'cidade_estimada': Empresa.Cidade_Empresa,
        'Telefone Normalizado': normalizePhoneNumber((Empresa.Telefones_Empresa || '').split(';')[0], Empresa.DDI_Empresa),
        'Negócio - Origem': Comercial.Origem,
        'Negócio - Canal de origem': Comercial.Origem,
        'Negócio - Fonte do Lead': Comercial.Sub_Origem,
        'Negócio - Funil': Comercial.Funil || 'Padrão',
        'Negócio - Etapa': Comercial.Etapa,
        'Negócio - Data de criação do negócio': new Date().toISOString(),
        'Negócio - Data atualizada': new Date().toISOString(),
    };

    return columnOrder.map(col => rowData[col] || '');
}

// --- Main Public Functions ---

const SHEETS_FOR_CLIENTE_ID = ['Leads Exact Spotter', 'layout_importacao_empresas', 'Sheet1', 'PERDECOMP'];

async function fetchAllClienteIds(): Promise<string[]> {
    const allIds = new Set<string>();
    for (const sheetName of SHEETS_FOR_CLIENTE_ID) {
        try {
            readCache.delete(`sheetData:${sheetName}:A:A`);
            const { rows } = await getSheetData(sheetName, 'A:A');
            for (const row of rows) {
                const clienteId = row['Cliente_ID'];
                if (clienteId) {
                    allIds.add(clienteId);
                }
            }
        } catch (err: any) {
            if (err.message.includes('Unable to parse range')) {
                console.warn(`Sheet "${sheetName}" not found or empty while fetching Cliente_IDs. Skipping.`);
            } else {
                console.error(`Error fetching Cliente_IDs from sheet "${sheetName}":`, err);
            }
        }
    }
    return Array.from(allIds);
}

export async function getNextClienteId(): Promise<string> {
  // Pass the fetcher function as a callback to be executed by the normalizer.
  return canonicalNextClienteId(() => fetchAllClienteIds());
}

const SHEETS_TO_SEARCH = ['Leads Exact Spotter', 'layout_importacao_empresas', 'Sheet1', 'PERDECOMP'];

export async function findByCnpj(cnpj: string): Promise<(SheetRow & { _sheetName: string }) | null> {
  const normalizedCnpjToFind = canonicalNormalizeCnpj(cnpj);
  if (!isValidCnpjPattern(normalizedCnpjToFind)) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowCnpj = row['CNPJ Empresa'] || row['CPF/CNPJ'];
      if (canonicalNormalizeCnpj(rowCnpj) === normalizedCnpjToFind) {
        return { ...row, _sheetName: sheetName };
      }
    }
  }
  return null;
}

export async function findByName(name: string): Promise<SheetRow | null> {
  const normalizedNameToFind = normalizeText(name);
  if (!normalizedNameToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowName = row['Nome da Empresa'] || row['Nome do Lead'];
      if (normalizeText(rowName) === normalizedNameToFind) {
        const rowCnpj = canonicalNormalizeCnpj(row['CNPJ Empresa'] || row['CPF/CNPJ']);
        if (!rowCnpj) {
          return row;
        }
      }
    }
  }
  return null;
}

export async function appendToSheets(payload: any): Promise<void> {
    // 1. Generate the new Cliente_ID centrally.
    const newClienteId = await getNextClienteId();
    const payloadWithId = { ...payload, Cliente_ID: newClienteId };

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetProcessOrder = [
        { name: 'Leads Exact Spotter', builder: buildLeadsExactSpotterRow },
        { name: 'layout_importacao_empresas', builder: buildLayoutImportacaoRow },
        { name: 'Sheet1', builder: buildSheet1Row },
    ];

    const errors: string[] = [];
    for (const sheet of sheetProcessOrder) {
        try {
            // 2. Use the payload with the guaranteed correct ID.
            const rowData = sheet.builder(payloadWithId);
            readCache.delete(`sheetData:${sheet.name}`);
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheet.name,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowData] },
            });
        } catch (err: any) {
            console.error(`Falha ao escrever na aba "${sheet.name}":`, err.message);
            errors.push(`Falha ao escrever na aba "${sheet.name}"`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Ocorreram erros ao salvar os dados: ${errors.join('; ')}`);
    }
}


// --- Legacy Functions for Backward Compatibility ---

export { getSheetsClient };

export async function findRowIndexById(sheetName: string, headersRow: number, idColumnName: string, idValue: any): Promise<number> {
    if (!process.env.SPREADSHEET_ID) {
        throw new Error('SPREADSHEET_ID is not set');
    }
    const normalizedId = String(idValue || '').trim();
    const { headers, rows } = await getSheetData(sheetName, `A${headersRow}:ZZ`);
    const idIdx = headers.indexOf(idColumnName);
    if (idIdx === -1) return -1;
    for (const row of rows) {
        const cell = String(row[idColumnName] || '').trim();
        if (cell === normalizedId) {
            return row._rowNumber;
        }
    }
    return -1;
}

export async function updateRowByIndex({ sheetName, rowIndex, updates }: UpdateRowPayload): Promise<void> {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        throw new Error('SPREADSHEET_ID is not set');
    }
    const sheets = await getSheetsClient();
    const { headers, rows } = await getSheetData(sheetName);
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => (headerMap[h] = i));
    const currentRow = rows.find((r) => r._rowNumber === rowIndex) || {};
    const data: any[] = [];
    Object.entries(updates || {}).forEach(([col, value]) => {
        const idx = headerMap[col];
        if (idx === undefined) return;
        const colLetter = columnNumberToLetter(idx + 1);
        const range = `${sheetName}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
        data.push({ range, values: [[value]] });
    });
    if (!data.length) return;
    await withRetry(() =>
        sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'RAW',
                data,
            },
        })
    );
}

export async function _findRowNumberByClienteId(sheetName: string, clienteId: string): Promise<number> {
    const { rows } = await getSheetData(sheetName);
    const rowIndex = rows.findIndex(row => row.Cliente_ID === clienteId);
    return rowIndex !== -1 ? rows[rowIndex]._rowNumber : -1;
}

export async function appendSheetData(sheetName: string, rowsToAppend: any[][]): Promise<void> {
  if (!sheetName || !rowsToAppend || rowsToAppend.length === 0) {
    throw new Error('sheetName and rowsToAppend are required.');
  }
  const sheets = await getSheetsClient();
  const batches = chunk(rowsToAppend, 500);
  for (const batch of batches) {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: batch },
      })
    );
  }
}

async function _getRawSheet(sheetName = 'Sheet1') {
    const sheets = await getSheetsClient();
    return withRetry(() =>
        sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: sheetName,
        })
    );
}

export async function getSheet(sheetName = 'Sheet1') {
    return _getRawSheet(sheetName);
}

export async function getSheetCached(sheetName = 'Sheet1') {
    const key = `sheet_raw:${sheetName}`;
    const cached = readCache.get(key);
    if (cached && (Date.now() - cached.time < 10000)) {
        return cached.data;
    }
    const data = await _getRawSheet(sheetName);
    readCache.set(key, { time: Date.now(), data });
    return data;
}

export async function getHistorySheetCached() {
    return getSheetCached('Historico_Interacoes');
}

export async function updateRow(rowNumber: number, data: Record<string, any>): Promise<void> {
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData('Sheet1');
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => (headerMap[h] = i));

    const updates: any[] = [];
    for (const key in data) {
        const colIndex = headerMap[key];
        if (colIndex !== undefined) {
            const colLetter = columnNumberToLetter(colIndex + 1);
            const range = `Sheet1!${colLetter}${rowNumber}`;
            updates.push({ range, values: [[data[key]]] });
        }
    }
    if (updates.length) {
        await withRetry(() =>
            sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: process.env.SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates,
                },
            })
        );
    }
}

export async function appendRow(data: Record<string, any>): Promise<void> {
    const columnOrder = [
        'Cliente_ID', 'Negócio - Título', 'Negócio - Origem / Canal de origem', 'Negócio - Fonte do Lead',
        'Organização - Segmento', 'Negócio - Nome do produto', 'País', 'uf', 'cidade_estimada',
        'Telefone Normalizado', 'Negócio - Pessoa de contato', 'Pessoa - Email - Work', 'Pessoa - Email - Home',
        'Pessoa - Email - Other', 'Pessoa - Cargo', 'Pessoa - Phone - Work', 'Pessoa - Phone - Home',
        'Pessoa - Phone - Mobile', 'Pessoa - Phone - Other', 'Organização - Nome', 'Funil'
    ];
    const row = columnOrder.map(header => data[header] || '');
    return appendSheetData('Sheet1', [row]);
}

export async function appendHistoryRow(data: Record<string, any>): Promise<void> {
    const { headers } = await getSheetData('Historico_Interacoes');
    const row = headers.map(header => data[header] || '');
    return appendSheetData('Historico_Interacoes', [row]);
}

export async function updateInSheets(clienteId: string, payload: any): Promise<void> {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders: Record<string, (p: any) => any[]> = {
        'Leads Exact Spotter': buildLeadsExactSpotterRow,
        'layout_importacao_empresas': buildLayoutImportacaoRow,
        'Sheet1': buildSheet1Row,
    };

    for (const sheetName in sheetBuilders) {
        readCache.delete(`sheetData:${sheetName}`);
        const rowNumber = await _findRowNumberByClienteId(sheetName, clienteId);
        if (rowNumber === -1) {
            console.warn(`Cliente_ID ${clienteId} not found in ${sheetName}. Skipping update.`);
            continue;
        }

        const rowValues = sheetBuilders[sheetName](payload);
        const rangeEndColumn = columnNumberToLetter(rowValues.length);
        const range = `${sheetName}!A${rowNumber}:${rangeEndColumn}${rowNumber}`;

        await withRetry(() =>
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowValues] },
            })
        );
    }
}