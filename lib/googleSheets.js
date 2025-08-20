import { google } from 'googleapis';

// --- Cache & Auth ---

const readCache = new Map();

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

// --- Generic Sheet Interaction ---

export async function getSheetData(sheetName, spreadsheetId = process.env.SPREADSHEET_ID) {
  const key = `sheetData:${sheetName}`;
  const cached = readCache.get(key);
  if (cached && (Date.now() - cached.time < 10000)) { // 10 second cache
    return cached.data;
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`, // Read all possible columns
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0];
  const data = rows.slice(1).map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
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
    const email = isValidEmail(Contato.Email_Contato) ? Contato.Email_Contato : '';

    const columnOrder = [
        'Cliente_ID', 'Negócio - Título', 'Negócio - Origem / Canal de origem', 'Negócio - Fonte do Lead',
        'Organização - Segmento', 'Negócio - Nome do produto', 'País', 'uf', 'cidade_estimada',
        'Telefone Normalizado', 'Negócio - Pessoa de contato', 'Pessoa - Email - Work', 'Pessoa - Email - Home',
        'Pessoa - Email - Other', 'Pessoa - Cargo', 'Pessoa - Phone - Work', 'Pessoa - Phone - Home',
        'Pessoa - Phone - Mobile', 'Pessoa - Phone - Other', 'Organização - Nome', 'Funil'
    ];

    return columnOrder.map(col => {
        switch(col) {
            case 'Cliente_ID': return payload.Cliente_ID;
            case 'Negócio - Título': return Empresa.Nome_da_Empresa;
            case 'Negócio - Origem / Canal de origem': return Comercial.Origem;
            case 'Negócio - Fonte do Lead': return Comercial.Sub_Origem;
            case 'Organização - Segmento': return Comercial.Mercado;
            case 'Negócio - Nome do produto': return Comercial.Produto;
            case 'País': return 'Brasil';
            case 'uf': return normalizeUF(Empresa.Estado_Empresa);
            case 'cidade_estimada': return Empresa.Cidade_Empresa;
            case 'Telefone Normalizado': return normalizePhoneNumber((Empresa.Telefones_Empresa || '').split(';')[0], Empresa.DDI_Empresa);
            case 'Negócio - Pessoa de contato': return Contato.Nome_Contato;
            case 'Pessoa - Email - Work': return email;
            case 'Pessoa - Email - Home': return '';
            case 'Pessoa - Email - Other': return '';
            case 'Pessoa - Cargo': return Contato.Cargo_Contato;
            case 'Pessoa - Phone - Work': return normalizePhoneNumber(contactPhones.Work, Contato.DDI_Contato);
            case 'Pessoa - Phone - Home': return normalizePhoneNumber(contactPhones.Home, Contato.DDI_Contato);
            case 'Pessoa - Phone - Mobile': return normalizePhoneNumber(contactPhones.Mobile, Contato.DDI_Contato);
            case 'Pessoa - Phone - Other': return normalizePhoneNumber(contactPhones.Other, Contato.DDI_Contato);
            case 'Organização - Nome': return Empresa.Nome_da_Empresa;
            case 'Funil': return 'Padrão';
            default: return '';
        }
    });
}


// --- Main Public Functions ---

export async function getNextClienteId() {
  readCache.delete(`sheetData:Leads Exact Spotter`);
  const { rows } = await getSheetData('Leads Exact Spotter');
  let maxId = 0;
  for (const row of rows) {
    const clienteId = row['Cliente_ID'];
    if (clienteId && typeof clienteId === 'string') {
      // Handle both "CLI-" and "CLT-" prefixes
      if (clienteId.startsWith('CLI-') || clienteId.startsWith('CLT-')) {
        const num = parseInt(clienteId.substring(4), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
  }
  // Generate new IDs with the correct "CLT-" prefix and no zero-padding
  return `CLT-${maxId + 1}`;
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

    const sheetLayouts = {
        'Leads Exact Spotter': buildLeadsExactSpotterRow(payload),
        'layout_importacao_empresas': buildLayoutImportacaoRow(payload),
        'Sheet1': buildSheet1Row(payload),
    };

    const errors = [];
    for (const sheetName in sheetLayouts) {
        try {
            readCache.delete(`sheetData:${sheetName}`);
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheetName,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [sheetLayouts[sheetName]] },
            });
        } catch (err) {
            console.error(`Falha ao escrever na aba "${sheetName}":`, err.message);
            errors.push(`Falha ao escrever na aba "${sheetName}"`);
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
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rowsToAppend },
  });
}

// The following functions are simplified reimplementations of what was there before
// to ensure other pages don't break. They might not be perfectly efficient
// but will prevent build failures.

async function _getRawSheet(sheetName = 'Sheet1') {
    const sheets = await getSheetsClient();
    return sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: sheetName,
    });
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
    const { headers } = await getSheetData('Sheet1'); // Assume Sheet1 for legacy
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    // This is a simplified version of the old updateRow
    for (const key in data) {
        const headerName = key; // Assume key is the header name
        const colIndex = headerMap[headerName];
        if (colIndex !== undefined) {
            const colLetter = columnNumberToLetter(colIndex + 1);
            const range = `Sheet1!${colLetter}${rowNumber}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[data[key]]] },
            });
        }
    }
}

export async function appendRow(data) {
    const sheets = await getSheetsClient();
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
    const sheets = await getSheetsClient();
    const { headers } = await getSheetData('Historico_Interacoes');
    const row = headers.map(header => data[header] || '');
    return appendSheetData('Historico_Interacoes', [row]);
}

export async function updateInSheets(clienteId, payload) {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetLayouts = {
        'Leads Exact Spotter': {
            data: buildLeadsExactSpotterRow(payload),
            cols: 30
        },
        'layout_importacao_empresas': {
            data: buildLayoutImportacaoRow(payload),
            cols: 15
        },
        'Sheet1': {
            data: buildSheet1Row(payload),
            cols: 21
        },
    };

    for (const sheetName in sheetLayouts) {
        readCache.delete(`sheetData:${sheetName}`);
        const rowNumber = await _findRowNumberByClienteId(sheetName, clienteId);
        if (rowNumber === -1) {
            console.warn(`Cliente_ID ${clienteId} not found in ${sheetName}. Skipping update.`);
            continue;
        }

        const rangeEndColumn = columnNumberToLetter(sheetLayouts[sheetName].cols);
        const range = `${sheetName}!A${rowNumber}:${rangeEndColumn}${rowNumber}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [sheetLayouts[sheetName].data] },
        });
    }
}
