import { google } from 'googleapis';
import https from 'https';

// --- Cache & Auth ---

const readCache = new Map();
let sheetsClientPromise;

/**
 * Returns a singleton Google Sheets client with keep-alive enabled.
 */
async function getSheetsClient() {
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
      google.options({ auth, httpAgent });
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return sheetsClientPromise;
}

/**
 * Retry helper for Google API calls. Retries on transient errors with
 * exponential backoff and jitter.
 */
export async function withRetry(fn, tries = 4) {
  let attempt = 0;
  let lastErr;
  while (attempt < tries) {
    try {
      return await fn();
    } catch (err) {
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

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// --- Generic Sheet Interaction ---

export async function getSheetData(sheetName, range = 'A:ZZ', spreadsheetId = process.env.SPREADSHEET_ID) {
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
  const headers = rawHeaders.map((h) => (h || '').toString().trim());

  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? '';
    });
    return obj;
  });

  const result = { headers, rows: data };
  readCache.set(key, { time: Date.now(), data: result });
  return result;
}

async function _findRowNumberByClienteId(sheetName, clienteId) {
    const { rows } = await getSheetData(sheetName);
    const rowIndex = rows.findIndex(row => row.Cliente_ID === clienteId);
    return rowIndex !== -1 ? rows[rowIndex]._rowNumber : -1;
}


// --- Data Transformation Helpers ---

function normalizeText(str) {
    return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCnpj(cnpj) {
    return (cnpj || '').toString().replace(/\D/g, '');
}

function normalizeUF(uf) {
  if (!uf) return '';
  const map = { AC:'AC',AL:'AL',AP:'AP',AM:'AM',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MT:'MT',MS:'MS',MG:'MG',PA:'PA',PB:'PB',PR:'PR',PE:'PE',PI:'PI',RJ:'RJ',RN:'RN',RS:'RS',RO:'RO',RR:'RR',SC:'SC',SP:'SP',SE:'SE',TO:'TO',ACRE:'AC',ALAGOAS:'AL',AMAPA:'AP',AMAZONAS:'AM',BAHIA:'BA',CEARA:'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES',GOIAS:'GO',MARANHAO:'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',PARA:'PA',PARAIBA:'PB',PARANA:'PR',PERNAMBUCO:'PE',PIAUI:'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',RONDONIA:'RO',RORAIMA:'RR','SANTA CATARINA':'SC','SAO PAULO':'SP',SERGIPE:'SE',TOCANTINS:'TO' };
  const cleaned = normalizeText(uf).toUpperCase();
  return map[cleaned] || '';
}

function normalizePhoneNumber(phone = '', ddi = '') {
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

function distributeContactPhones(phonesString = '') {
    const phones = phonesString.split(';').map(p => p.trim()).filter(Boolean);
    return {
        Work: phones[0] || '',
        Mobile: phones[1] || '',
        Home: phones[2] || '',
        Other: phones[3] || '',
    };
}

function isValidEmail(email = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function columnNumberToLetter(columnNumber) {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}


// --- Row Builders for Each Sheet Layout ---

function buildLeadsExactSpotterRow(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const columnOrder = [
        'Cliente_ID', 'Nome do Lead', 'Origem', 'Sub-Origem', 'Mercado', 'Produto', 'Site', 'País', 'Estado', 'Cidade',
        'Logradouro', 'Número', 'Bairro', 'Complemento', 'CEP', 'DDI', 'Telefones', 'Observação', 'CPF/CNPJ',
        'Nome Contato', 'E-mail Contato', 'Cargo Contato', 'DDI Contato', 'Telefones Contato',
        'Tipo do Serv. Comunicação', 'ID do Serv. Comunicação', 'Área', 'Nome da Empresa', 'Etapa', 'Funil'
    ];

    const row = columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Nome do Lead': return Empresa.Nome_da_Empresa; // As per spec
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
            case 'CPF/CNPJ': return normalizeCnpj(Empresa.CNPJ_Empresa);
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
    return row;
}

function buildLayoutImportacaoRow(payload) {
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
            case 'CNPJ Empresa': return normalizeCnpj(Empresa.CNPJ_Empresa);
            case 'DDI Empresa': return Empresa.DDI_Empresa;
            case 'Telefones Empresa': return Empresa.Telefones_Empresa;
            case 'Observação Empresa': return Empresa.Observacao_Empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload) {
    const { Empresa, Contato, Comercial } = payload;
    const contactPhones = distributeContactPhones(Contato.Telefones_Contato);

    const columnOrder = [
        'Negócio - Título', 'Negócio - Valor', 'Negócio - Organização', 'Negócio - Pessoa de contato', 'Negócio - Data de fechamento esperada', 'Negócio - Data da próxima atividade', 'Negócio - Proprietário', 'Negócio - Etapa', 'Negócio - Fonte do Lead', 'Negócio - Qualificação Lead (Closer)', 'Negócio - Qualificação do Lead (SDR)', 'Negócio - Motivo da perda', 'Negócio - Data de criação do negócio', 'Negócio - SDR Responsável', 'Negócio - Ganho em', 'Negócio - Data de perda', 'Negócio - VLR Mensalidade', 'Negócio - VLR Implantação', 'Negócio - Ranking', 'Negócio - Negócio fechado em', 'Negócio - [Closer] Lead é o Decisor?', 'Negócio - Atividades concluídas', 'Negócio - Atividades para fazer', 'Negócio - Criador', 'Negócio - Data atualizada', 'Negócio - Data da última atividade', 'Negócio - Etiqueta', 'Negócio - Funil', 'Negócio - Moeda de VLR Mensalidade', 'Negócio - Moeda de VLR Implantação', 'Negócio - Canal de origem', 'Negócio - MRR', 'Negócio - Valor de produtos', 'Negócio - Valor ponderado', 'Negócio - Moeda', 'Negócio - ID', 'Negócio - ID de origem', 'Negócio - ID do canal de origem', 'Negócio - Nome do produto', 'Negócio - Número de mensagens de e-mail', 'Negócio - Origem', 'Negócio - Probabilidade', 'Negócio - ACV', 'Negócio - ARR', 'Negócio - Quantidade de produtos', 'Negócio - Telefone do Closer', 'Negócio - Tempo de Implantação', 'Negócio - Total de atividades', 'Negócio - UTM CAMPAIGN', 'Negócio - UTM CONTENT', 'Negócio - UTM MEDIUM', 'Negócio - UTM_SOURCE', 'Negócio - UTM_TERM', 'Negócio - Visível para', 'Negócio - Última alteração de etapa', 'Negócio - Último e-mail enviado', 'Negócio - Último e-mail recebido', 'Pessoa - Cargo', 'Pessoa - Email - Work', 'Pessoa - Email - Home', 'Pessoa - Email - Other', 'Pessoa - End. Linkedin', 'Pessoa - Phone - Work', 'Pessoa - Phone - Home', 'Pessoa - Phone - Mobile', 'Pessoa - Phone - Other', 'Pessoa - Telefone', 'Pessoa - Celular', 'Organização - Nome', 'Organização - Segmento', 'Organização - Tamanho da empresa', 'Negócio - Status', 'ddd', 'uf', 'cidade_estimada', 'fonte_localizacao', 'Status_Kanban', 'Cor_Card', 'Data_Ultima_Movimentacao', 'Impresso_Lista', 'Telefone Normalizado', 'Cliente_ID'
    ];

    const rowData = {
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

export async function getNextClienteId() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const SHEET = 'Leads Exact Spotter';
  const headerName = 'Cliente_ID';

  // 1. Find the column index for Cliente_ID
  const headRes = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET}'!1:1`,
    })
  );
  const headers = (headRes.data.values?.[0] || []).map(h => (h || '').trim());
  const idx0 = headers.findIndex(h => h.toLowerCase() === headerName.toLowerCase());
  if (idx0 < 0) {
    // This could happen if the sheet is empty. Assume 'A' and let it fail if header is not there.
    // A more robust solution might be to create the header, but that's out of scope.
    // For now, if no headers, we assume the first ID is 1.
    const { data } = await withRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${SHEET}'!A:A`,
      })
    );
    if (!data.values || data.values.length <= 1) {
      // Sheet is empty or has only a header
      return 'CLT-1';
    }
    // Fallback for safety, though the logic below should handle it.
  }
  const colLetter = columnNumberToLetter(idx0 + 1);

  // 2. Get all values from that column only
  const { data } = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET}'!${colLetter}:${colLetter}`,
    })
  );
  const values = (data.values || []).flat().map(v => String(v || '').trim());

  // 3. Find the max number from values like "CLT-123"
  let maxNum = 0;
  for (const v of values) {
    const m = /^CLT-(\d+)$/i.exec(v); // Use ignore-case flag for robustness
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `CLT-${maxNum + 1}`;
}

const SHEETS_TO_SEARCH = ['Leads Exact Spotter', 'layout_importacao_empresas', 'Sheet1'];

export async function findByCnpj(cnpj) {
  const normalizedCnpjToFind = normalizeCnpj(cnpj);
  if (!normalizedCnpjToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    // Invalidate cache to ensure fresh data for checks
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowCnpj = row['CNPJ Empresa'] || row['CPF/CNPJ'];
      if (normalizeCnpj(rowCnpj) === normalizedCnpjToFind) {
        return { ...row, _sheetName: sheetName };
      }
    }
  }
  return null;
}

export async function findByName(name) {
  const normalizedNameToFind = normalizeText(name);
  if (!normalizedNameToFind) return null;

  for (const sheetName of SHEETS_TO_SEARCH) {
    readCache.delete(`sheetData:${sheetName}`);
    const { rows } = await getSheetData(sheetName);
    for (const row of rows) {
      const rowName = row['Nome da Empresa'] || row['Nome do Lead'];
      if (normalizeText(rowName) === normalizedNameToFind) {
        const rowCnpj = normalizeCnpj(row['CNPJ Empresa'] || row['CPF/CNPJ']);
        if (!rowCnpj) {
          // Return the full row data for pre-filling the form
          return row;
        }
      }
    }
  }
  return null;
}

export async function appendToSheets(payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Use an array to guarantee the order of operations as requested.
    const sheetProcessOrder = [
        { name: 'Leads Exact Spotter', builder: buildLeadsExactSpotterRow },
        { name: 'layout_importacao_empresas', builder: buildLayoutImportacaoRow },
        { name: 'Sheet1', builder: buildSheet1Row },
    ];

    const errors = [];
    for (const sheet of sheetProcessOrder) {
        try {
            const rowData = sheet.builder(payload);
            readCache.delete(`sheetData:${sheet.name}`);
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheet.name,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [rowData] },
            });
        } catch (err) {
            console.error(`Falha ao escrever na aba "${sheet.name}":`, err.message);
            errors.push(`Falha ao escrever na aba "${sheet.name}"`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Ocorreram erros ao salvar os dados: ${errors.join('; ')}`);
    }
}


// --- Legacy Functions for Backward Compatibility ---

// Re-export getSheetsClient for pages that use it directly
export { getSheetsClient };

// Generic append for simple data structures (used by older APIs)
export async function appendSheetData(sheetName, rowsToAppend) {
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

// The following functions are simplified reimplementations of what was there before
// to ensure other pages don't break. They might not be perfectly efficient
// but will prevent build failures.

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

export async function updateRow(rowNumber, data) {
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData('Sheet1');
    const headerMap = {};
    headers.forEach((h, i) => (headerMap[h] = i));

    const updates = [];
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

export async function appendRow(data) {
    // Define the canonical column order to ensure data is written to the correct column
    // regardless of the physical order in the spreadsheet. This is the same order
    // used by the `buildSheet1Row` function.
    const columnOrder = [
        'Cliente_ID', 'Negócio - Título', 'Negócio - Origem / Canal de origem', 'Negócio - Fonte do Lead',
        'Organização - Segmento', 'Negócio - Nome do produto', 'País', 'uf', 'cidade_estimada',
        'Telefone Normalizado', 'Negócio - Pessoa de contato', 'Pessoa - Email - Work', 'Pessoa - Email - Home',
        'Pessoa - Email - Other', 'Pessoa - Cargo', 'Pessoa - Phone - Work', 'Pessoa - Phone - Home',
        'Pessoa - Phone - Mobile', 'Pessoa - Phone - Other', 'Organização - Nome', 'Funil'
    ];
    // Build the row array based on the canonical order, not the physical sheet order.
    const row = columnOrder.map(header => data[header] || '');
    return appendSheetData('Sheet1', [row]);
}

export async function appendHistoryRow(data) {
    const { headers } = await getSheetData('Historico_Interacoes');
    const row = headers.map(header => data[header] || '');
    return appendSheetData('Historico_Interacoes', [row]);
}

export async function updateInSheets(clienteId, payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders = {
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
