import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import { agregaPerdcomp, parsePerdcompNumero, normalizaMotivo, PerdcompFamilia } from '@/utils/perdcomp';

export const runtime = 'nodejs';

// --- Planilha & Colunas ---
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const PERDCOMP_SHEET_NAME = 'PERDECOMP';
const PERDCOMP_ITENS_SHEET_NAME = 'PERDCOMP_ITENS';
const DIC_CREDITOS_SHEET_NAME = 'DIC_CREDITOS';

const PERDCOMP_ITENS_HEADERS = [
  'Cliente_ID', 'Empresa_ID', 'Nome da Empresa', 'CNPJ', 'Perdcomp_Numero', 'Perdcomp_Formatado',
  'B1', 'B2', 'Data_DDMMAA', 'Data_ISO', 'Tipo_Codigo', 'Tipo_Nome', 'Natureza', 'Familia',
  'Credito_Codigo', 'Credito_Descricao', 'Protocolo', 'Situacao', 'Situacao_Detalhamento',
  'Motivo_Normalizado', 'Solicitante', 'Fonte', 'Data_Consulta',
];

// --- Funções Auxiliares (Restauradas) ---

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function jitter(base: number) {
    return Math.round(base * (0.8 + Math.random() * 0.4));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delays = [1500, 3000, 5000]): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status ?? err?.status ?? 0;
      const shouldRetry = status >= 500 || status === 0 || err.providerCode === undefined; // Retry on 5xx, network errors, or non-provider errors
      if (!shouldRetry || i === attempts - 1) throw err;
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastErr;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addYears(dateISO: string, years: number) {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

async function getCreditosDict(): Promise<Record<string, string>> {
  try {
    const { rows, headers } = await getSheetData(DIC_CREDITOS_SHEET_NAME);
    const codeIndex = headers.indexOf('Credito_Codigo');
    const descIndex = headers.indexOf('Descricao');
    if (codeIndex === -1 || descIndex === -1) return {};
    return rows.reduce((acc, row) => {
      const code = row[codeIndex];
      if (code) acc[code] = row[descIndex];
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error(`Falha ao carregar ${DIC_CREDITOS_SHEET_NAME}`, error);
    return {};
  }
}

async function getExistingPerdcompIds(cnpj: string): Promise<Set<string>> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const sheetExists = spreadsheet.data.sheets?.some(
            s => s.properties?.title === PERDCOMP_ITENS_SHEET_NAME
        );

        if (!sheetExists) {
            console.warn(`Aba ${PERDCOMP_ITENS_SHEET_NAME} não encontrada. Assumindo que está vazia.`);
            return new Set();
        }

        const { rows, headers } = await getSheetData(PERDCOMP_ITENS_SHEET_NAME);
        const cnpjIndex = headers.indexOf('CNPJ');
        const perdcompNumIndex = headers.indexOf('Perdcomp_Numero');
        if (cnpjIndex === -1 || perdcompNumIndex === -1) return new Set();

        const ids = rows
            .filter(row => padCNPJ14(row[cnpjIndex]) === cnpj)
            .map(row => row[perdcompNumIndex])
            .filter(Boolean);

        return new Set(ids);
    } catch (error) {
        console.error(`Falha ao verificar ou ler a aba ${PERDCOMP_ITENS_SHEET_NAME}`, error);
        // Em caso de qualquer outro erro, retorna um set vazio para não bloquear a operação principal.
        return new Set();
    }
}

async function getLastPerdcompFromSheet({ cnpj, clienteId }: { cnpj?: string; clienteId?: string; }) {
  try {
    const { rows, headers } = await getSheetData(PERDCOMP_SHEET_NAME);
    const idxCliente = headers.indexOf('Cliente_ID');
    const idxCnpj = headers.indexOf('CNPJ');
    const match = rows.find(r => (clienteId && r[idxCliente] === clienteId) || (cnpj && padCNPJ14(r[idxCnpj]) === cnpj));
    if (!match) return null;

    const dcomp = Number(match[headers.indexOf('Qtd_PERDCOMP_DCOMP')] ?? 0);
    const rest = Number(match[headers.indexOf('Qtd_PERDCOMP_REST')] ?? 0);
    const ressarc = Number(match[headers.indexOf('Qtd_PERDCOMP_RESSARC')] ?? 0);
    const canc = Number(match[headers.indexOf('Qtd_PERDCOMP_CANCEL')] ?? 0);
    const totalSemCancelamento = Number(match[headers.indexOf('Qtd_PERDCOMP_TOTAL_SEM_CANCEL')] ?? 0);

    return {
      quantidade: totalSemCancelamento || (dcomp + rest + ressarc),
      dcomp, rest, ressarc, canc,
      site_receipt: match[headers.indexOf('URL_Comprovante_HTML')] || null,
      requested_at: match[headers.indexOf('Data_Consulta')] || null,
    };
  } catch (e) {
    console.error("Error getting last perdcomp from sheet:", e);
    return null;
  }
}


// --- Lógica Principal da Rota ---

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const cnpj = padCNPJ14(body?.cnpj ?? '');
    if (!isValidCNPJ(cnpj)) {
      return NextResponse.json({ error: true, message: 'CNPJ inválido' }, { status: 400 });
    }

    const { clienteId, nomeEmpresa, force = false, debug: debugMode = false } = body;
    if (!clienteId || !nomeEmpresa) {
        return NextResponse.json({ message: 'clienteId e nomeEmpresa são obrigatórios.' }, { status: 400 });
    }

    let data_fim = body?.data_fim?.slice(0, 10) || todayISO();
    let data_inicio = body?.data_inicio?.slice(0, 10) || addYears(data_fim, -5);

    // Restaurando a lógica de cache
    if (!force) {
        const cachedData = await getLastPerdcompFromSheet({ cnpj, clienteId });
        if (cachedData && cachedData.requested_at) {
             const { rows } = await getSheetData(PERDCOMP_SHEET_NAME);
             const row = rows.find(r => padCNPJ14(r.CNPJ) === cnpj || r.Cliente_ID === clienteId);
             if (row) {
                const resumo = {
                    total: Number(row.Qtd_PERDCOMP_TOTAL || 0),
                    canc: Number(row.Qtd_PERDCOMP_CANCEL || 0),
                    totalSemCancelamento: Number(row.Qtd_PERDCOMP_TOTAL_SEM_CANCEL || 0),
                    porFamilia: {
                        DCOMP: Number(row.Qtd_PERDCOMP_DCOMP || 0),
                        REST: Number(row.Qtd_PERDCOMP_REST || 0),
                        RESSARC: Number(row.Qtd_PERDCOMP_RESSARC || 0),
                        CANC: Number(row.Qtd_PERDCOMP_CANCEL || 0),
                        DESCONHECIDO: 0,
                    } as Record<PerdcompFamilia, number>,
                    // Outros campos do resumo podem ser reconstruídos ou armazenados se necessário
                    topCreditos: [],
                    porMotivo: {} as any,
                    porNatureza: {},
                    cancelamentosLista: (row.Lista_PERDCOMP_CANCEL || '').split('; '),
                };
                return NextResponse.json({
                    ok: true,
                    fonte: 'planilha',
                    perdcompResumo: resumo,
                    perdcomp: [], // Não retornamos a lista detalhada do cache
                    header: { requested_at: cachedData.requested_at },
                });
             }
        }
    }

    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) throw new Error('INFOSIMPLES_TOKEN is not set');

    const params = new URLSearchParams({ token, cnpj, data_inicio, data_fim, timeout: '600' });
    const apiEndpoint = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';

    const doCall = async () => {
      const resp = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const json = await resp.json();
      if (!resp.ok || (json && ![200, 612].includes(json.code))) {
        const err: any = new Error('provider_error');
        err.status = resp.status;
        err.providerCode = json?.code;
        err.providerMessage = json?.code_message || json?.message;
        throw err;
      }
      return json;
    };

    let apiResponse;
    try {
        apiResponse = await withRetry(doCall);
    } catch (err: any) {
        const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
        return NextResponse.json(
            {
              error: true,
              httpStatus: err?.status || 502,
              providerCode: err?.providerCode,
              message: err?.providerMessage || 'API error',
              fallback,
            },
            { status: err?.status || 502 }
        );
    }

    const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
    const perdcompArray = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];

    const creditosDict = await getCreditosDict();
    const resumo = agregaPerdcomp(perdcompArray, creditosDict);
    const headerRequestedAt = apiResponse?.header?.requested_at || new Date().toISOString();

    if (perdcompArray.length > 0) {
        const existingIds = await getExistingPerdcompIds(cnpj);
        const newItemsValues: (string | number | boolean)[][] = [];

        for (const item of perdcompArray) {
          if (!item.perdcomp || existingIds.has(item.perdcomp)) continue;
          const p = parsePerdcompNumero(item.perdcomp);
          if (!p.valido) continue;

          const motivo = normalizaMotivo(item.situacao, item.situacao_detalhamento);
          const rowData: {[key: string]: any} = {
            'Cliente_ID': clienteId, 'Empresa_ID': clienteId, 'Nome da Empresa': nomeEmpresa, 'CNPJ': `'${cnpj}`,
            'Perdcomp_Numero': item.perdcomp, 'Perdcomp_Formatado': p.formatted || '', 'B1': p.b1, 'B2': p.b2,
            'Data_DDMMAA': p.dataDDMMAA, 'Data_ISO': p.dataISO, 'Tipo_Codigo': p.tipoNum,
            'Tipo_Nome': p.tipoNum === 1 ? 'DCOMP' : p.tipoNum === 2 ? 'REST' : p.tipoNum === 8 ? 'CANC' : 'DESCONHECIDO',
            'Natureza': p.natureza, 'Familia': p.familia, 'Credito_Codigo': p.credito,
            'Credito_Descricao': creditosDict[p.credito!] || '(pendente de descrição)',
            'Protocolo': p.protocolo, 'Situacao': item.situacao, 'Situacao_Detalhamento': item.situacao_detalhamento,
            'Motivo_Normalizado': motivo, 'Solicitante': item.solicitante, 'Fonte': 'consulta_individual',
            'Data_Consulta': headerRequestedAt,
          };
          newItemsValues.push(PERDCOMP_ITENS_HEADERS.map(h => rowData[h] ?? ''));
        }

        if (newItemsValues.length > 0) {
          const sheets = await getSheetsClient();
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: PERDCOMP_ITENS_SHEET_NAME,
            valueInputOption: 'USER_ENTERED', requestBody: { values: newItemsValues },
          });
        }
    }

    const { headers, rows } = await getSheetData(PERDCOMP_SHEET_NAME).catch(err => {
        if (err.message.includes('Unable to parse range')) {
            console.warn(`Aba ${PERDCOMP_SHEET_NAME} está vazia ou não foi encontrada. Tratando como nova.`);
            return { headers: [], rows: [] };
        }
        throw err;
    });
    const rowIndex = rows.findIndex(r => padCNPJ14(r.CNPJ) === cnpj || r.Cliente_ID === clienteId);

    const top3CreditosStr = resumo.topCreditos.map(c => `${c.codigo}:${c.quantidade}`).join(' | ');
    const situacoesStr = Object.entries(resumo.porMotivo).filter(([, qtd]) => qtd > 0).map(([motivo, qtd]) => `${motivo}:${qtd}`).join(' | ');

    const updateData = {
      'Quantidade_PERDCOMP': resumo.totalSemCancelamento,
      'Qtd_PERDCOMP_TOTAL': resumo.total, 'Qtd_PERDCOMP_TOTAL_SEM_CANCEL': resumo.totalSemCancelamento,
      'Qtd_PERDCOMP_DCOMP': resumo.porFamilia.DCOMP, 'Qtd_PERDCOMP_REST': resumo.porFamilia.REST,
      'Qtd_PERDCOMP_RESSARC': resumo.porFamilia.RESSARC, 'Qtd_PERDCOMP_CANCEL': resumo.porFamilia.CANC,
      'TOP3_CREDITOS': top3CreditosStr, 'SITUACOES_NORMALIZADAS': situacoesStr,
      'Lista_PERDCOMP_CANCEL': resumo.cancelamentosLista.join('; '), 'Data_Consulta': headerRequestedAt,
      'URL_Comprovante_HTML': apiResponse?.site_receipts?.[0] || '',
    };

    const sheets = await getSheetsClient();
    if (rowIndex !== -1) {
      const rowNumber = rows[rowIndex]._rowNumber;
      const dataForBatchUpdate = Object.entries(updateData).map(([key, value]) => {
          const colIndex = headers.indexOf(key);
          if (colIndex === -1) return null;
          const colLetter = String.fromCharCode(65 + colIndex);
          return { range: `${PERDCOMP_SHEET_NAME}!${colLetter}${rowNumber}`, values: [[value]] }
      }).filter((x): x is { range: string; values: any[][]; } => x !== null);

      if (dataForBatchUpdate.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: SPREADSHEET_ID,
              requestBody: { valueInputOption: 'USER_ENTERED', data: dataForBatchUpdate }
          });
      }
    } else {
        const newRow = headers.map(h => {
            if (h === 'Cliente_ID') return clienteId;
            if (h === 'Nome da Empresa') return nomeEmpresa;
            if (h === 'CNPJ') return `'${cnpj}`;
            return updateData[h as keyof typeof updateData] ?? '';
        });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: PERDCOMP_SHEET_NAME,
            valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] },
        });
    }

    const finalResponse = {
      ok: true, perdcomp: perdcompArray, perdcompResumo: resumo,
      header: apiResponse.header,
      debug: debugMode ? { ...apiResponse, perdcompResumo: resumo } : undefined,
    };

    return NextResponse.json(finalResponse);

  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    const response = {
      error: true, message: error?.providerMessage || error?.message || 'Erro interno no servidor.',
      httpStatus: error?.status || 500, providerCode: error?.providerCode,
    };
    return NextResponse.json(response, { status: error?.status || 500 });
  }
}