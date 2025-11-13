import { google } from 'googleapis';
import https from 'https';

import { normalizePayloadToSnakeCase } from './sheets/generalMapping';

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

export async function findRowIndexById(sheetName, headersRow, idColumnName, idValue) {
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

export async function updateRowByIndex({ sheetName, rowIndex, updates }) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set');
  }
  const sheets = await getSheetsClient();
  const { headers, rows } = await getSheetData(sheetName);
  const headerMap = {};
  headers.forEach((h, i) => (headerMap[h] = i));
  const currentRow = rows.find((r) => r._rowNumber === rowIndex) || {};
  const data = [];
  Object.entries(updates || {}).forEach(([col, value]) => {
    const idx = headerMap[col];
    if (idx === undefined) return;
    const colLetter = columnNumberToLetter(idx + 1);
    const range = `${sheetName}!${colLetter}${rowIndex}:${colLetter}${rowIndex}`;
    data.push({ range, values: [[value]] });
    console.log('[updateRowByIndex]', {
      sheetName,
      rowIndex,
      campoAtualizado: col,
      valorAntigo: currentRow[col] ?? '',
      valorNovo: value,
      rangeUsado: range,
    });
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

export async function _findRowNumberBycliente_id(sheetName, cliente_id) {
    const { rows } = await getSheetData(sheetName);
    const rowIndex = rows.findIndex(row => row.cliente_id === cliente_id);
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
    const { empresa = {}, contato = {}, comercial = {} } = payload;
    const columnOrder = [
        'cliente_id', 'nome_do_lead', 'origem', 'sub_origem', 'mercado', 'produto', 'site', 'pais', 'estado', 'cidade',
        'logradouro', 'numero', 'bairro', 'complemento', 'cep', 'ddi', 'telefones', 'observacao', 'cpf_cnpj',
        'nome_contato', 'email_contato', 'cargo_contato', 'ddi_contato', 'telefones_contato',
        'tipo_do_serv_comunicacao', 'id_do_serv_comunicacao', 'area', 'nome_da_empresa', 'etapa', 'funil'
    ];

    const row = columnOrder.map(col => {
        switch(col) {
            case 'cliente_id': return payload.cliente_id;
            case 'nome_do_lead': return empresa.nome_da_empresa;
            case 'origem': return comercial.origem;
            case 'sub_origem': return comercial.sub_origem;
            case 'mercado': return comercial.mercado;
            case 'produto': return comercial.produto;
            case 'site': return empresa.site_empresa;
            case 'pais': return empresa.pais_empresa;
            case 'estado': return empresa.estado_empresa;
            case 'cidade': return empresa.cidade_empresa;
            case 'logradouro': return empresa.logradouro_empresa;
            case 'numero': return empresa.numero_empresa;
            case 'bairro': return empresa.bairro_empresa;
            case 'complemento': return empresa.complemento_empresa;
            case 'cep': return empresa.cep_empresa;
            case 'ddi': return empresa.ddi_empresa;
            case 'telefones': return empresa.telefones_empresa;
            case 'observacao': return empresa.observacao_empresa;
            case 'cpf_cnpj': return normalizeCnpj(empresa.cnpj_empresa);
            case 'nome_contato': return contato.nome_contato;
            case 'email_contato': return contato.email_contato;
            case 'cargo_contato': return contato.cargo_contato;
            case 'ddi_contato': return contato.ddi_contato;
            case 'telefones_contato': return contato.telefones_contato;
            case 'tipo_do_serv_comunicacao': return comercial.tipo_do_serv_comunicacao;
            case 'id_do_serv_comunicacao': return comercial.id_do_serv_comunicacao;
            case 'area': return comercial.area;
            case 'nome_da_empresa': return empresa.nome_da_empresa;
            case 'etapa': return comercial.etapa;
            case 'funil': return comercial.funil;
            default: return '';
        }
    });
    return row;
}

function buildLayoutImportacaoRow(payload) {
    const { empresa = {} } = payload;
    const columnOrder = [
        'cliente_id', 'nome_da_empresa', 'site_empresa', 'pais_empresa', 'estado_empresa', 'cidade_empresa',
        'logradouro_empresa', 'numero_empresa', 'bairro_empresa', 'complemento_empresa', 'cep_empresa',
        'cnpj_empresa', 'ddi_empresa', 'telefones_empresa', 'observacao_empresa'
    ];

    return columnOrder.map(col => {
        switch(col) {
            case 'cliente_id': return payload.cliente_id;
            case 'nome_da_empresa': return empresa.nome_da_empresa;
            case 'site_empresa': return empresa.site_empresa;
            case 'pais_empresa': return empresa.pais_empresa;
            case 'estado_empresa': return empresa.estado_empresa;
            case 'cidade_empresa': return empresa.cidade_empresa;
            case 'logradouro_empresa': return empresa.logradouro_empresa;
            case 'numero_empresa': return empresa.numero_empresa;
            case 'bairro_empresa': return empresa.bairro_empresa;
            case 'complemento_empresa': return empresa.complemento_empresa;
            case 'cep_empresa': return empresa.cep_empresa;
            case 'cnpj_empresa': return normalizeCnpj(empresa.cnpj_empresa);
            case 'ddi_empresa': return empresa.ddi_empresa;
            case 'telefones_empresa': return empresa.telefones_empresa;
            case 'observacao_empresa': return empresa.observacao_empresa;
            default: return '';
        }
    });
}

function buildSheet1Row(payload) {
    const { empresa = {}, contato = {}, comercial = {} } = payload;
    const contactPhones = distributeContactPhones(contato.telefones_contato);

    const columnOrder = [
        'negocio_titulo', 'negocio_valor', 'negocio_organizacao', 'negocio_pessoa_de_contato', 'negocio_data_de_fechamento_esperada', 'negocio_data_da_proxima_atividade', 'negocio_proprietario', 'negocio_etapa', 'negocio_fonte_do_lead', 'negocio_qualificacao_lead_closer', 'negocio_qualificacao_do_lead_sdr', 'negocio_motivo_da_perda', 'negocio_data_de_criacao_do_negocio', 'negocio_sdr_responsavel', 'negocio_ganho_em', 'negocio_data_de_perda', 'negocio_vlr_mensalidade', 'negocio_vlr_implantacao', 'negocio_ranking', 'negocio_negocio_fechado_em', 'negocio_closer_lead_e_o_decisor', 'negocio_atividades_concluidas', 'negocio_atividades_para_fazer', 'negocio_criador', 'negocio_data_atualizada', 'negocio_data_da_ultima_atividade', 'negocio_etiqueta', 'negocio_funil', 'negocio_moeda_de_vlr_mensalidade', 'negocio_moeda_de_vlr_implantacao', 'negocio_canal_de_origem', 'negocio_mrr', 'negocio_valor_de_produtos', 'negocio_valor_ponderado', 'negocio_moeda', 'negocio_id', 'negocio_id_de_origem', 'negocio_id_do_canal_de_origem', 'negocio_nome_do_produto', 'negocio_numero_de_mensagens_de_e-mail', 'negocio_origem', 'negocio_probabilidade', 'negocio_acv', 'negocio_arr', 'negocio_quantidade_de_produtos', 'negocio_telefone_do_closer', 'negocio_tempo_de_implantacao', 'negocio_total_de_atividades', 'negocio_utm_campaign', 'negocio_utm_content', 'negocio_utm_medium', 'negocio_utm_source', 'negocio_utm_term', 'negocio_visivel_para', 'negocio_ultima_alteracao_de_etapa', 'negocio_ultimo_e-mail_enviado', 'negocio_ultimo_e-mail_recebido', 'pessoa_cargo', 'pessoa_email_work', 'pessoa_email_home', 'pessoa_email_other', 'pessoa_end_linkedin', 'pessoa_phone_work', 'pessoa_phone_home', 'pessoa_phone_mobile', 'pessoa_phone_other', 'pessoa_telefone', 'pessoa_celular', 'organizacao_nome', 'organizacao_segmento', 'organizacao_tamanho_da_empresa', 'negocio_status', 'ddd', 'uf', 'cidade_estimada', 'fonte_localizacao', 'status_kanban', 'cor_card', 'data_ultima_movimentacao', 'impresso_lista', 'telefone_normalizado', 'cliente_id'
    ];

    const rowData = {
        'cliente_id': payload.cliente_id,
        'negocio_titulo': empresa.nome_da_empresa,
        'negocio_organizacao': empresa.nome_da_empresa,
        'organizacao_nome': empresa.nome_da_empresa,
        'negocio_pessoa_de_contato': contato.nome_contato,
        'pessoa_cargo': contato.cargo_contato,
        'pessoa_email_work': isValidEmail(contato.email_contato) ? contato.email_contato : '',
        'pessoa_phone_work': normalizePhoneNumber(contactPhones.Work, contato.ddi_contato),
        'pessoa_phone_home': normalizePhoneNumber(contactPhones.Home, contato.ddi_contato),
        'pessoa_phone_mobile': normalizePhoneNumber(contactPhones.Mobile, contato.ddi_contato),
        'pessoa_phone_other': normalizePhoneNumber(contactPhones.Other, contato.ddi_contato),
        'pessoa_telefone': contato.telefones_contato,
        'organizacao_segmento': comercial.mercado,
        'negocio_nome_do_produto': comercial.produto,
        'uf': normalizeUF(empresa.estado_empresa),
        'cidade_estimada': empresa.cidade_empresa,
        'telefone_normalizado': normalizePhoneNumber((empresa.telefones_empresa || '').split(';')[0], empresa.ddi_empresa),
        'negocio_origem': comercial.origem,
        'negocio_canal_de_origem': comercial.origem,
        'negocio_fonte_do_lead': comercial.sub_origem,
        'negocio_funil': comercial.funil || 'Padrão',
        'negocio_etapa': comercial.etapa,
        'negocio_data_de_criacao_do_negocio': new Date().toISOString(),
        'negocio_data_atualizada': new Date().toISOString(),
    };

    return columnOrder.map(col => rowData[col] || '');
}


// --- Main Public Functions ---

export async function getNextcliente_id() {
  readCache.delete(`sheetData:Leads Exact Spotter`);
  const { rows } = await getSheetData('Leads Exact Spotter');
  let maxId = 0;
  for (const row of rows) {
    const cliente_id = row['cliente_id'];
    if (cliente_id && typeof cliente_id === 'string') {
      // Handle both "CLI-" and "CLT-" prefixes
      if (cliente_id.startsWith('CLI-') || cliente_id.startsWith('CLT-')) {
        const num = parseInt(cliente_id.substring(4), 10);
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
      const rowCnpj = row['cnpj_empresa'] || row['cpf_cnpj'];
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
      const rowName = row['nome_da_empresa'] || row['nome_do_lead'];
      if (normalizeText(rowName) === normalizedNameToFind) {
        const rowCnpj = normalizeCnpj(row['cnpj_empresa'] || row['cpf_cnpj']);
        if (!rowCnpj) {
          // Return the full row data for pre-filling the form
          return row;
        }
      }
    }
  }
  return null;
}

export async function appendToSheets(rawPayload) {
    const payload = normalizePayloadToSnakeCase(rawPayload);
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

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
        'cliente_id', 'negocio_titulo', 'negocio_origem_canal_de_origem', 'negocio_fonte_do_lead',
        'organizacao_segmento', 'negocio_nome_do_produto', 'pais', 'uf', 'cidade_estimada',
        'telefone_normalizado', 'negocio_pessoa_de_contato', 'pessoa_email_work', 'pessoa_email_home',
        'pessoa_email_other', 'pessoa_cargo', 'pessoa_phone_work', 'pessoa_phone_home',
        'pessoa_phone_mobile', 'pessoa_phone_other', 'organizacao_nome', 'funil'
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

export async function updateInSheets(rawPayload, cliente_id) {
    const payload = normalizePayloadToSnakeCase(rawPayload);
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const sheetBuilders = {
        'Leads Exact Spotter': buildLeadsExactSpotterRow,
        'layout_importacao_empresas': buildLayoutImportacaoRow,
        'Sheet1': buildSheet1Row,
    };

    for (const sheetName in sheetBuilders) {
        readCache.delete(`sheetData:${sheetName}`);
        const rowNumber = await _findRowNumberBycliente_id(sheetName, cliente_id);
        if (rowNumber === -1) {
            console.warn(`cliente_id ${cliente_id} not found in ${sheetName}. Skipping update.`);
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
