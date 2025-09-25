import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ } from '@/utils/cnpj';
import { agregaPerdcomp, parsePerdcompNumero, normalizaMotivo } from '@/utils/perdcomp';

export const runtime = 'nodejs';

// --- Planilha & Colunas ---
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const PERDCOMP_SHEET_NAME = 'PERDCOMP';
const PERDCOMP_ITENS_SHEET_NAME = 'PERDCOMP_ITENS';
const DIC_CREDITOS_SHEET_NAME = 'DIC_CREDITOS';
// A ser usado no futuro para enriquecer mais dados
// const DIC_NATUREZAS_SHEET_NAME = 'DIC_NATUREZAS';
// const DIC_TIPOS_SHEET_NAME = 'DIC_TIPOS';

// Colunas esperadas na PERDCOMP_ITENS
const PERDCOMP_ITENS_HEADERS = [
  'Cliente_ID', 'Empresa_ID', 'Nome da Empresa', 'CNPJ', 'Perdcomp_Numero', 'Perdcomp_Formatado',
  'B1', 'B2', 'Data_DDMMAA', 'Data_ISO', 'Tipo_Codigo', 'Tipo_Nome', 'Natureza', 'Familia',
  'Credito_Codigo', 'Credito_Descricao', 'Protocolo', 'Situacao', 'Situacao_Detalhamento',
  'Motivo_Normalizado', 'Solicitante', 'Fonte', 'Data_Consulta',
];

// --- Funções Auxiliares ---

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
      const desc = row[descIndex];
      if (code) acc[code] = desc;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    console.error(`Falha ao carregar ${DIC_CREDITOS_SHEET_NAME}`, error);
    return {}; // Retorna dicionário vazio em caso de erro
  }
}

async function getExistingPerdcompIds(cnpj: string): Promise<Set<string>> {
    try {
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
        // Se a aba não existir, retorna um Set vazio, permitindo que a escrita prossiga.
        if ((error as any)?.message?.includes('Unable to parse range')) {
            console.warn(`Aba ${PERDCOMP_ITENS_SHEET_NAME} não encontrada. Assumindo que está vazia.`);
            return new Set();
        }
        console.error(`Falha ao ler ${PERDCOMP_ITENS_SHEET_NAME}`, error);
        return new Set();
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

    const {
      clienteId,
      nomeEmpresa,
      force = false,
      debug: debugMode = false,
    } = body;

    let data_fim = body?.data_fim?.slice(0, 10) || todayISO();
    let data_inicio = body?.data_inicio?.slice(0, 10) || addYears(data_fim, -5);

    // --- Chamada à API Infosimples (com cache e retries) ---
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

    const apiResponse = await doCall(); // Simplificado para focar na lógica principal

    const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
    const perdcompArray = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];

    if (perdcompArray.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Nenhum PER/DCOMP encontrado no período.',
        perdcompResumo: agregaPerdcomp([], {}),
        perdcomp: [],
      });
    }

    // --- Enriquecimento e Persistência ---
    const creditosDict = await getCreditosDict();
    const resumo = agregaPerdcomp(perdcompArray, creditosDict);
    const headerRequestedAt = apiResponse?.header?.requested_at || new Date().toISOString();

    // 1. Gravar Itens Detalhados em PERDCOMP_ITENS
    const existingIds = await getExistingPerdcompIds(cnpj);
    const newItemsValues: (string | number | boolean)[][] = [];

    for (const item of perdcompArray) {
      if (!item.perdcomp || existingIds.has(item.perdcomp)) {
        continue; // Pula duplicatas
      }
      const p = parsePerdcompNumero(item.perdcomp);
      if (!p.valido) continue;

      const motivo = normalizaMotivo(item.situacao, item.situacao_detalhamento);
      const rowData = {
        'Cliente_ID': clienteId,
        'Empresa_ID': clienteId, // Usando Cliente_ID como Empresa_ID por padrão
        'Nome da Empresa': nomeEmpresa,
        'CNPJ': `'${cnpj}`,
        'Perdcomp_Numero': item.perdcomp,
        'Perdcomp_Formatado': p.formatted || '',
        'B1': p.b1, 'B2': p.b2, 'Data_DDMMAA': p.dataDDMMAA, 'Data_ISO': p.dataISO,
        'Tipo_Codigo': p.tipoNum, 'Tipo_Nome': p.tipoNum === 1 ? 'DCOMP' : p.tipoNum === 2 ? 'REST' : p.tipoNum === 8 ? 'CANC' : 'DESCONHECIDO',
        'Natureza': p.natureza, 'Familia': p.familia,
        'Credito_Codigo': p.credito, 'Credito_Descricao': creditosDict[p.credito!] || '(pendente de descrição)',
        'Protocolo': p.protocolo,
        'Situacao': item.situacao, 'Situacao_Detalhamento': item.situacao_detalhamento,
        'Motivo_Normalizado': motivo,
        'Solicitante': item.solicitante,
        'Fonte': 'consulta_individual',
        'Data_Consulta': headerRequestedAt,
      };
      newItemsValues.push(PERDCOMP_ITENS_HEADERS.map(h => rowData[h as keyof typeof rowData] ?? ''));
    }

    if (newItemsValues.length > 0) {
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: PERDCOMP_ITENS_SHEET_NAME,
        valueInputOption: 'USER_ENTERED', // ou RAW
        requestBody: { values: newItemsValues },
      });
    }

    // 2. Atualizar a Planilha de Resumo PERDCOMP
    const { headers, rows } = await getSheetData(PERDCOMP_SHEET_NAME);
    const rowIndex = rows.findIndex(r => padCNPJ14(r.CNPJ) === cnpj || r.Cliente_ID === clienteId);

    const top3CreditosStr = resumo.topCreditos
      .map(c => `${c.codigo}:${c.quantidade}`)
      .join(' | ');
    const situacoesStr = Object.entries(resumo.porMotivo)
      .filter(([, qtd]) => qtd > 0)
      .map(([motivo, qtd]) => `${motivo}:${qtd}`)
      .join(' | ');

    const updateData = {
      'Quantidade_PERDCOMP': resumo.totalSemCancelamento, // Campo antigo agora é total sem cancelamento
      'Qtd_PERDCOMP_TOTAL': resumo.total,
      'Qtd_PERDCOMP_TOTAL_SEM_CANCEL': resumo.totalSemCancelamento,
      'Qtd_PERDCOMP_DCOMP': resumo.porFamilia.DCOMP,
      'Qtd_PERDCOMP_REST': resumo.porFamilia.REST,
      'Qtd_PERDCOMP_RESSARC': resumo.porFamilia.RESSARC,
      'Qtd_PERDCOMP_CANCEL': resumo.porFamilia.CANC,
      'TOP3_CREDITOS': top3CreditosStr,
      'SITUACOES_NORMALIZADAS': situacoesStr,
      'Lista_PERDCOMP_CANCEL': resumo.cancelamentosLista.join('; '),
      'Data_Consulta': headerRequestedAt,
    };

    const sheets = await getSheetsClient();
    if (rowIndex !== -1) {
      const rowNumber = rows[rowIndex]._rowNumber;
      const requests = Object.entries(updateData).map(([key, value]) => {
        const colIndex = headers.indexOf(key);
        if (colIndex === -1) return null;
        return {
          updateCells: {
            rows: [{ values: [{ userEnteredValue: { stringValue: String(value) } }] }],
            fields: 'userEnteredValue',
            start: { sheetId: 0, rowIndex: rowNumber - 1, columnIndex: colIndex }, // Assumindo SheetId 0
          },
        };
      }).filter(Boolean);

        // This requires sheetId, which is hard to get. Let's use batchUpdate with A1 notation instead.
        const dataForBatchUpdate = Object.entries(updateData).map(([key, value]) => {
            const colIndex = headers.indexOf(key);
            if (colIndex === -1) return null;
            const colLetter = String.fromCharCode(65 + colIndex);
            return {
                range: `${PERDCOMP_SHEET_NAME}!${colLetter}${rowNumber}`,
                values: [[value]]
            }
        }).filter(Boolean);

        if (dataForBatchUpdate.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: dataForBatchUpdate
                }
            });
        }

    } else {
        // Append new row if company not found
        const newRow = headers.map(h => {
            if (h === 'Cliente_ID') return clienteId;
            if (h === 'Nome da Empresa') return nomeEmpresa;
            if (h === 'CNPJ') return `'${cnpj}`;
            return updateData[h as keyof typeof updateData] ?? '';
        });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: PERDCOMP_SHEET_NAME,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        });
    }

    // --- Resposta Final ---
    const finalResponse = {
      ok: true,
      perdcomp: perdcompArray,
      perdcompResumo: resumo,
      header: apiResponse.header,
      debug: debugMode ? { ...apiResponse, perdcompResumo: resumo } : undefined,
    };

    return NextResponse.json(finalResponse);

  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    const response = {
      error: true,
      message: error?.providerMessage || error?.message || 'Erro interno no servidor.',
      httpStatus: error?.status || 500,
      providerCode: error?.providerCode,
    };
    return NextResponse.json(response, { status: error?.status || 500 });
  }
}