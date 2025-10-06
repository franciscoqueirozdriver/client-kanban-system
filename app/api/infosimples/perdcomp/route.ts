import { NextResponse } from 'next/server';
import { getSheetData, getSheetsClient } from '../../../../lib/googleSheets.js';
import { padCNPJ14, isValidCNPJ, formatCnpj } from '@/utils/cnpj';
import { agregaPerdcomp } from '@/utils/perdcomp';
import {
  loadPerdecompSnapshot,
  savePerdecompResults,
  uniqueSortedDatesISO,
  minDateISO,
  maxDateISO,
  type SaveArgs,
} from '@/lib/perdecomp-persist';
import type {
  CardPayload,
  RiskTag,
  CountBlock,
  SnapshotMetadata,
} from '@/types/perdecomp-card';
import {
  parsePerdcomp,
  TIPOS_DOCUMENTO,
  NATUREZA_FAMILIA,
  NATUREZA_OBSERVACOES,
  CREDITOS_DESCRICAO,
  CREDITO_RISCO,
  CREDITO_RECOMENDACOES,
  CREDITO_CATEGORIA,
} from '@/lib/perdcomp';

export const runtime = 'nodejs';

const PERDECOMP_SHEET_NAME = 'PERDECOMP';

const REQUIRED_HEADERS = [
  'Cliente_ID', 'Nome da Empresa', 'Perdcomp_ID', 'CNPJ', 'Tipo_Pedido',
  'Situacao', 'Periodo_Inicio', 'Periodo_Fim', 'Quantidade_PERDCOMP',
  'Qtd_PERDCOMP_DCOMP', 'Qtd_PERDCOMP_REST', 'Qtd_PERDCOMP_RESSARC', 'Qtd_PERDCOMP_CANCEL',
  'Numero_Processo', 'Data_Protocolo', 'Ultima_Atualizacao',
  'Quantidade_Receitas', 'Quantidade_Origens', 'Quantidade_DARFs',
  'URL_Comprovante_HTML', 'URL_Comprovante_PDF', 'Data_Consulta',
  'Tipo_Empresa', 'Concorrentes',
  'Code', 'Code_Message', 'MappedCount', 'Perdcomp_Principal_ID',
  'Perdcomp_Solicitante', 'Perdcomp_Tipo_Documento',
  'Perdcomp_Tipo_Credito', 'Perdcomp_Data_Transmissao',
  'Perdcomp_Situacao', 'Perdcomp_Situacao_Detalhamento'
];

const RISK_LABEL_NORMALIZATION: Record<string, string> = {
  MEDIO: 'MÉDIO',
};

function normalizeRiskLabel(label?: string | null) {
  if (!label) return '';
  const upper = String(label).trim().toUpperCase();
  if (!upper) return '';
  return RISK_LABEL_NORMALIZATION[upper] ?? upper;
}

function determineOverallRiskLevel(riskCounts: Map<string, number>, hasFacts: boolean) {
  if (riskCounts.get('ALTO')) return 'ALTO';
  if (riskCounts.get('MÉDIO')) return 'MÉDIO';
  if (riskCounts.get('BAIXO')) return 'BAIXO';
  if (hasFacts) return 'DESCONHECIDO';
  return '';
}

function buildResumoFromCard(card: CardPayload | null | undefined) {
  if (!card) return null;
  const map = new Map<string, number>();
  for (const block of card.quantos_sao || []) {
    if (!block) continue;
    const label = String(block.label || '').toUpperCase();
    if (!label) continue;
    map.set(label, Number(block.count ?? 0));
  }

  const porFamilia = {
    DCOMP: map.get('DCOMP') ?? 0,
    REST: map.get('REST') ?? 0,
    RESSARC: map.get('RESSARC') ?? 0,
    CANC: map.get('CANC') ?? 0,
    DESCONHECIDO: map.get('DESCONHECIDO') ?? 0,
  };

  const canc = porFamilia.CANC;
  const totalSemCancelamento = Number(card.quantidade_total ?? 0) || 0;
  const porNaturezaAgrupada = Object.fromEntries(
    (card.por_natureza || []).map(block => [block.label, block.count])
  );

  return {
    total: totalSemCancelamento + canc,
    totalSemCancelamento,
    canc,
    porFamilia,
    porNaturezaAgrupada,
  };
}

function columnNumberToLetter(columnNumber: number) {
  let temp;
  let letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addYears(dateISO: string, years: number) {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

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
      const shouldRetry = status >= 500 || status === 0;
      if (!shouldRetry || i === attempts - 1) throw err;
      await sleep(jitter(delays[i] ?? 2000));
    }
  }
  throw lastErr;
}

async function getLastPerdcompFromSheet({
  cnpj,
  clienteId,
}: {
  cnpj?: string;
  clienteId?: string;
}) {
  const sheets = await getSheetsClient();
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'PERDECOMP!1:1',
  });
  const headers = head.data.values?.[0] || [];
  const col = (name: string) => headers.indexOf(name);
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'PERDECOMP!A2:Z',
  });
  const rows = resp.data.values || [];
  const idxCliente = col('Cliente_ID');
  const idxCnpj = col('CNPJ');
  const idxQtd = col('Quantidade_PERDCOMP');
  const idxHtml = col('URL_Comprovante_HTML');
  const idxData = col('Data_Consulta');
  const idxQtdDcomp = col('Qtd_PERDCOMP_DCOMP');
  const idxQtdRest = col('Qtd_PERDCOMP_REST');
  const idxQtdRessarc = col('Qtd_PERDCOMP_RESSARC');
  const idxQtdCancel = col('Qtd_PERDCOMP_CANCEL');
  const match = rows.find(
    r =>
      (clienteId && r[idxCliente] === clienteId) ||
      (cnpj && (r[idxCnpj] || '').replace(/\D/g, '') === cnpj)
  );
  if (!match) return null;
  const qtd = Number(match[idxQtd] ?? 0);
  const dcomp = Number(match[idxQtdDcomp] ?? 0);
  const rest = Number(match[idxQtdRest] ?? 0);
  const ressarc = Number(match[idxQtdRessarc] ?? 0);
  const canc = Number(match[idxQtdCancel] ?? 0);
  return {
    quantidade: qtd || 0,
    dcomp,
    rest,
    ressarc,
    canc,
    site_receipt: match[idxHtml] || null,
    requested_at: match[idxData] || null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    const rawCnpj = body?.cnpj ?? url.searchParams.get('cnpj') ?? '';
    const cnpj = padCNPJ14(rawCnpj);
    if (!isValidCNPJ(cnpj)) {
      return NextResponse.json(
        { error: true, httpStatus: 400, httpStatusText: 'Bad Request', message: 'CNPJ inválido' },
        { status: 400 }
      );
    }

    let data_fim = (body?.data_fim ?? url.searchParams.get('data_fim') ?? '').toString().slice(0, 10);
    let data_inicio = (body?.data_inicio ?? url.searchParams.get('data_inicio') ?? '').toString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) {
      data_inicio = addYears(data_fim, -5);
    }

    const force = body?.force ?? false;
    const debugMode = body?.debug ?? false;
    const clienteId =
      body?.Cliente_ID ??
      body?.clienteId ??
      url.searchParams.get('Cliente_ID') ??
      url.searchParams.get('clienteId');
    const nomeEmpresa =
      body?.Nome_da_Empresa ??
      body?.nomeEmpresa ??
      url.searchParams.get('Nome_da_Empresa') ??
      url.searchParams.get('nomeEmpresa');
    const empresaId =
      body?.Empresa_ID ??
      body?.empresaId ??
      body?.EmpresaId ??
      '';
    if (!clienteId || !nomeEmpresa) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const preferCacheParam = body?.preferCache ?? url.searchParams.get('preferCache');
    const preferCache = preferCacheParam === undefined ? true : String(preferCacheParam) !== '0';

    if (!force && preferCache && clienteId) {
      try {
        const snapshot = await loadPerdecompSnapshot(clienteId);
        if (snapshot?.card) {
          const consultedAtISO =
            snapshot.metadata.dataConsulta ||
            snapshot.metadata.renderedAtISO ||
            snapshot.card.rendered_at_iso ||
            '';
          return NextResponse.json({
            ok: true,
            source: 'snapshot',
            consultedAtISO,
            card: snapshot.card,
            metadata: snapshot.metadata,
            perdcompResumo: buildResumoFromCard(snapshot.card),
            perdcompCodigos: snapshot.card.codigos_identificados?.map(code => code.codigo) || [],
            site_receipt: snapshot.metadata.urlComprovanteHTML || snapshot.card.links?.html || '',
          });
        }
      } catch (error) {
        console.error('[PERDCOMP] snapshot load error', error);
      }
    }

    const requestedAt = new Date().toISOString();
    const apiRequest = {
      cnpj,
      data_inicio,
      data_fim,
      timeout: 600,
      endpoint: 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp',
    };

    // 1. If not forcing, check the spreadsheet first
    if (!force) {
      const { rows } = await getSheetData(PERDECOMP_SHEET_NAME);

      const dataForCnpj = rows.filter(row => {
        const rowCnpj = padCNPJ14(row.CNPJ);
        return row.Cliente_ID === clienteId || rowCnpj === cnpj;
      });

      if (dataForCnpj.length > 0) {
        const lastConsulta = dataForCnpj.reduce((acc, r) => {
          const dc = r.Data_Consulta;
          // Only consider valid-looking dates (basic ISO format check)
          if (!dc || typeof dc !== 'string' || !dc.startsWith('20')) return acc;
          try {
            // Check if dates are valid before comparing
            const d1 = new Date(dc);
            if (isNaN(d1.getTime())) return acc;
            if (!acc) return dc;
            const d2 = new Date(acc);
            if (isNaN(d2.getTime())) return dc;
            return d1 > d2 ? dc : acc;
          } catch {
            return acc;
          }
        }, '');

        const rawQtd = dataForCnpj[0]?.Quantidade_PERDCOMP ?? '0';
        const qtdSemCanc = parseInt(String(rawQtd).replace(/\D/g, ''), 10) || 0;
        const dcomp = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_DCOMP ?? '0').replace(/\D/g, ''), 10) || 0;
        const rest = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_REST ?? '0').replace(/\D/g, ''), 10) || 0;
        const ressarc = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_RESSARC ?? '0').replace(/\D/g, ''), 10) || 0;
        const canc = parseInt(String(dataForCnpj[0]?.Qtd_PERDCOMP_CANCEL ?? '0').replace(/\D/g, ''), 10) || 0;
        const porFamilia = { DCOMP: dcomp, REST: rest, RESSARC: ressarc, CANC: canc, DESCONHECIDO: 0 };
        const porNaturezaAgrupada = {
          '1.3/1.7': dcomp,
          '1.2/1.6': rest,
          '1.1/1.5': ressarc,
        };
        const total = dcomp + rest + ressarc + canc;
        const resumo = {
          total,
          totalSemCancelamento: qtdSemCanc || dcomp + rest + ressarc,
          canc,
          porFamilia,
          porNaturezaAgrupada,
        };
        const resp: any = {
          ok: true,
          fonte: 'planilha',
          linhas: dataForCnpj,
          perdcompResumo: resumo,
          total_perdcomp: resumo.total,
          perdcompCodigos: [], // Códigos individuais não disponíveis na planilha
        };
        if (debugMode) {
          resp.debug = {
            requestedAt,
            fonte: 'planilha',
            apiRequest,
            apiResponse: null,
            mappedCount: dataForCnpj.length,
            header: { requested_at: lastConsulta },
            total_perdcomp: resumo.total,
          };
        }
        return NextResponse.json(resp);
      }
    }

    // 2. If forced or no data found, call the Infosimples API
    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) {
      throw new Error('INFOSIMPLES_TOKEN is not set in .env.local');
    }

    const params = new URLSearchParams({
      token: token,
      cnpj: cnpj,
      data_inicio: data_inicio,
      data_fim: data_fim,
      timeout: '600',
    });

    const doCall = async () => {
      const resp = await fetch(apiRequest.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const text = await resp.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
      // Allow 200 (OK) and 612 (No data found) to be treated as "successful" calls
      if (!resp.ok || (json && typeof json.code === 'number' && ![200, 612].includes(json.code))) {
        const err: any = new Error('provider_error');
        err.status = resp.status || 502;
        err.statusText = resp.statusText || 'Bad Gateway';
        err.providerCode = json?.code;
        err.providerMessage =
          json?.code_message || json?.message || json?.errors?.[0]?.message || null;
        throw err;
      }
      return json;
    };

    let apiResponse: any;
    try {
      apiResponse = await withRetry(doCall, 3, [1500, 3000, 5000]);
    } catch (err: any) {
      const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
      return NextResponse.json(
        {
          error: true,
          httpStatus: err?.status || 502,
          httpStatusText: err?.statusText || 'Bad Gateway',
          providerCode: err?.providerCode ?? null,
          providerMessage: err?.providerMessage ?? err?.message ?? 'API error',
          fallback,
        },
        { status: err?.status || 502 }
      );
    }

    if (debugMode && apiResponse?.header?.parameters?.token) {
      delete apiResponse.header.parameters.token;
    }

    const headerRequestedAt = apiResponse?.header?.requested_at || requestedAt;
    // If code is 612 (no data), treat perdcomp array as empty
    const perdcompArrayRaw = apiResponse?.code === 612 ? [] : apiResponse?.data?.[0]?.perdcomp;
    const perdcompArray = Array.isArray(perdcompArrayRaw) ? perdcompArrayRaw : [];
    const resumo = agregaPerdcomp(perdcompArray);
    const first = perdcompArray[0] || {};
    const totalPerdcomp = resumo.total;
    const mappedCount = apiResponse?.mapped_count || totalPerdcomp;
    const siteReceipt = apiResponse?.site_receipts?.[0] || '';

    const renderedAtISO = new Date().toISOString();
    const ultimaConsultaISO = headerRequestedAt || requestedAt;
    const formattedCnpj = formatCnpj(cnpj);
    const factsForPersistence: SaveArgs['facts'] = [];
    const identifiedCodes: CardPayload['codigos_identificados'] = [];
    const riskCounts = new Map<string, number>();
    const creditCounts = new Map<string, number>();
    const recommendations = new Set<string>();

    for (const item of perdcompArray) {
      const rawCode = String(item?.perdcomp ?? '').trim();
      if (!rawCode) continue;

      const parsed = parsePerdcomp(rawCode);
      const formatted = parsed.formatted ?? rawCode;
      const blocks = formatted.split('.');
      const dataBlock = blocks.length > 2 ? blocks[2] : '';
      const tipoInfo = parsed.bloco4 ? TIPOS_DOCUMENTO[parsed.bloco4] : undefined;
      const tipoCodigo = tipoInfo?.nome ?? (item?.tipo_documento ? String(item.tipo_documento).toUpperCase() : '');
      const tipoNome = tipoInfo?.desc ?? (item?.tipo_documento ?? '');
      const naturezaCodigo = parsed.natureza ?? '';
      const naturezaNome = naturezaCodigo ? NATUREZA_OBSERVACOES[naturezaCodigo] ?? naturezaCodigo : '';
      const familia = naturezaCodigo ? NATUREZA_FAMILIA[naturezaCodigo] ?? '' : '';
      const creditoCodigo = parsed.credito ?? '';
      const creditoDescricao =
        creditoCodigo ? CREDITOS_DESCRICAO[creditoCodigo] ?? (item?.tipo_credito ?? '') : item?.tipo_credito ?? '';
      const creditoGrupo = creditoCodigo ? CREDITO_CATEGORIA[creditoCodigo] ?? 'Genérico' : 'Genérico';
      const riscoBase = creditoCodigo ? CREDITO_RISCO[creditoCodigo] : undefined;
      const riskLabel = normalizeRiskLabel(riscoBase);
      const riskTagLabel = riskLabel || 'DESCONHECIDO';
      const protocolo = parsed.protocolo ?? (item?.protocolo ? String(item.protocolo) : '');
      const situacao = item?.situacao ?? '';
      const situacaoDetalhamento = item?.situacao_detalhamento ?? '';
      const motivoNormalizado = item?.motivo_normalizado ?? item?.motivo ?? '';
      const solicitante = item?.solicitante ?? '';
      const dataIso = parsed.dataISO ?? (item?.data_transmissao ? String(item.data_transmissao).slice(0, 10) : '');

      const fact: SaveArgs['facts'][number] = {
        Perdcomp_Numero: rawCode,
        Perdcomp_Formatado: formatted,
        B1: parsed.sequencia ?? '',
        B2: parsed.controle ?? '',
        Data_DDMMAA: dataBlock,
        Data_ISO: dataIso,
        Tipo_Codigo: tipoCodigo,
        Tipo_Nome: tipoNome,
        Natureza: naturezaNome,
        Familia: familia || '',
        Credito_Codigo: creditoCodigo,
        Credito_Descricao: creditoDescricao,
        Risco_Nivel: riskTagLabel,
        Protocolo: protocolo,
        Situacao: situacao,
        Situacao_Detalhamento: situacaoDetalhamento,
        Motivo_Normalizado: motivoNormalizado,
        Solicitante: solicitante,
      };
      factsForPersistence.push(fact);

      identifiedCodes.push({
        codigo: formatted,
        risco: riskTagLabel,
        credito_tipo: creditoDescricao || 'Não identificado',
        grupo: creditoGrupo,
        natureza: naturezaNome || '',
        protocolo: protocolo || undefined,
        situacao: situacao || undefined,
        situacao_detalhamento: situacaoDetalhamento || undefined,
        data_iso: dataIso || undefined,
      });

      riskCounts.set(riskTagLabel, (riskCounts.get(riskTagLabel) ?? 0) + 1);
      if (creditoDescricao) {
        creditCounts.set(creditoDescricao, (creditCounts.get(creditoDescricao) ?? 0) + 1);
      }
      const recomendacao = creditoCodigo ? CREDITO_RECOMENDACOES[creditoCodigo] : undefined;
      if (recomendacao) {
        recommendations.add(recomendacao);
      }
    }

    const quantosSao: CountBlock[] = [
      { label: 'DCOMP', count: resumo.porFamilia.DCOMP },
      { label: 'REST', count: resumo.porFamilia.REST },
      { label: 'RESSARC', count: resumo.porFamilia.RESSARC },
      { label: 'CANC', count: resumo.porFamilia.CANC },
    ].filter(block => block.count > 0);

    const porNaturezaBlocks: CountBlock[] = Object.entries(resumo.porNaturezaAgrupada ?? {})
      .map(([label, count]) => ({ label, count }))
      .filter(block => block.count > 0);

    const porCreditoBlocks: CountBlock[] = Array.from(creditCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const tagsRisco: RiskTag[] = Array.from(riskCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const riscoNivel = determineOverallRiskLevel(riskCounts, factsForPersistence.length > 0);

    const cardPayload: CardPayload = {
      header: {
        nome: nomeEmpresa,
        cnpj: formattedCnpj,
        ultima_consulta_iso: ultimaConsultaISO,
      },
      quantidade_total: resumo.totalSemCancelamento ?? factsForPersistence.length,
      analise_risco: {
        nivel: riscoNivel,
        tags: tagsRisco,
      },
      quantos_sao: quantosSao,
      por_natureza: porNaturezaBlocks,
      por_credito: porCreditoBlocks,
      codigos_identificados: identifiedCodes,
      recomendacoes: Array.from(recommendations),
      links: siteReceipt ? { html: siteReceipt } : undefined,
      schema_version: 1,
      rendered_at_iso: renderedAtISO,
    };

    const consultaId = `${clienteId}-${Date.now()}`;
    const fonte = 'PERDCOMP';

    const writes: Record<string, any> = {
      Code: apiResponse.code,
      Code_Message: apiResponse.code_message || '',
      MappedCount: mappedCount,
      Quantidade_PERDCOMP: resumo.totalSemCancelamento,
      Qtd_PERDCOMP_DCOMP: resumo.porFamilia.DCOMP,
      Qtd_PERDCOMP_REST: resumo.porFamilia.REST,
      Qtd_PERDCOMP_RESSARC: resumo.porFamilia.RESSARC,
      Qtd_PERDCOMP_CANCEL: resumo.porFamilia.CANC,
      URL_Comprovante_HTML: siteReceipt,
      Data_Consulta: headerRequestedAt,
      Perdcomp_Principal_ID: first?.perdcomp || '',
      Perdcomp_Solicitante: first?.solicitante || '',
      Perdcomp_Tipo_Documento: first?.tipo_documento || '',
      Perdcomp_Tipo_Credito: first?.tipo_credito || '',
      Perdcomp_Data_Transmissao: first?.data_transmissao || '',
      Perdcomp_Situacao: first?.situacao || '',
      Perdcomp_Situacao_Detalhamento: first?.situacao_detalhamento || '',
    };

    const sheets = await getSheetsClient();
    // Call getSheetData ONCE and get both headers and rows
    const { headers, rows } = await getSheetData(PERDECOMP_SHEET_NAME);
    const finalHeaders = [...headers];
    let headerUpdated = false;
    for (const h of REQUIRED_HEADERS) {
      if (!finalHeaders.includes(h)) {
        finalHeaders.push(h);
        headerUpdated = true;
      }
    }
    if (headerUpdated) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: `${PERDECOMP_SHEET_NAME}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [finalHeaders] },
      });
    }

    // Use the 'rows' we already fetched instead of calling getSheetData again
    let rowNumber = -1;
    for (const r of rows) {
      if (r.Cliente_ID === clienteId || String(r.CNPJ || '').replace(/\D/g, '') === cnpj) {
        rowNumber = r._rowNumber;
        break;
      }
    }

    if (rowNumber !== -1) {
      const data = [] as any[];
      for (const [key, value] of Object.entries(writes)) {
        if (value === undefined || value === '') continue;
        const colIndex = finalHeaders.indexOf(key);
        if (colIndex === -1) continue;
        const colLetter = columnNumberToLetter(colIndex + 1);
        data.push({
          range: `${PERDECOMP_SHEET_NAME}!${colLetter}${rowNumber}`,
          values: [[value]],
        });
      }
      if (data.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.SPREADSHEET_ID!,
          requestBody: { valueInputOption: 'RAW', data },
        });
      }
    } else {
      const row: Record<string, any> = {};
      finalHeaders.forEach(h => (row[h] = ''));
      row['Cliente_ID'] = clienteId;
      row['Nome da Empresa'] = nomeEmpresa;
      row['CNPJ'] = `'${cnpj}`;
      for (const [k, v] of Object.entries(writes)) {
        if (v !== undefined) row[k] = v;
      }
      const values = finalHeaders.map(h => row[h]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: PERDECOMP_SHEET_NAME,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }

    const sortedDates = uniqueSortedDatesISO(factsForPersistence.map(f => f.Data_ISO));
    const consultedAtISO = cardPayload.rendered_at_iso || ultimaConsultaISO || new Date().toISOString();
    const metadataForResponse: Partial<SnapshotMetadata> = {
      clienteId,
      empresaId,
      nome: nomeEmpresa,
      cnpj,
      riscoNivel: riscoNivel,
      tagsRisco: tagsRisco,
      porNatureza: porNaturezaBlocks,
      porCredito: porCreditoBlocks,
      datas: sortedDates,
      primeiraDataISO: minDateISO(sortedDates),
      ultimaDataISO: maxDateISO(sortedDates),
      renderedAtISO: cardPayload.rendered_at_iso,
      cardSchemaVersion: cardPayload.schema_version,
      fonte,
      dataConsulta: ultimaConsultaISO,
      urlComprovanteHTML: siteReceipt,
      factsCount: factsForPersistence.length,
      consultaId,
      erroUltimaConsulta: '',
      qtdTotal: cardPayload.quantidade_total ?? factsForPersistence.length,
      qtdDcomp: resumo.porFamilia.DCOMP,
      qtdRest: resumo.porFamilia.REST,
      qtdRessarc: resumo.porFamilia.RESSARC,
    };

    const resp: any = {
      ok: true,
      source: 'network',
      consultedAtISO,
      card: cardPayload,
      metadata: metadataForResponse,
      header: { requested_at: headerRequestedAt },
      mappedCount,
      total_perdcomp: totalPerdcomp,
      site_receipt: siteReceipt,
      perdcomp: perdcompArray,
      perdcompResumo: resumo,
      perdcompCodigos: perdcompArray.map((item: any) => item.perdcomp).filter(Boolean),
      primeiro: {
        perdcomp: first?.perdcomp,
        solicitante: first?.solicitante,
        tipo_documento: first?.tipo_documento,
        tipo_credito: first?.tipo_credito,
        data_transmissao: first?.data_transmissao,
        situacao: first?.situacao,
        situacao_detalhamento: first?.situacao_detalhamento,
      },
      cnpj,
    };
    if (debugMode) {
      resp.debug = {
        requestedAt,
        fonte: 'api',
        apiRequest,
        apiResponse,
        mappedCount,
        siteReceipts: apiResponse?.site_receipts,
        header: apiResponse?.header,
        total_perdcomp: totalPerdcomp,
        perdcompResumo: resumo,
      };
    }

    try {
      await savePerdecompResults({
        clienteId,
        empresaId,
        nome: nomeEmpresa,
        cnpj,
        consultaId,
        fonte,
        dataConsultaISO: ultimaConsultaISO,
        urlComprovanteHTML: siteReceipt,
        facts: factsForPersistence,
        card: cardPayload,
        risco_nivel: riscoNivel,
        tags_risco: tagsRisco,
        por_natureza: porNaturezaBlocks,
        por_credito: porCreditoBlocks,
        erroUltimaConsulta: '',
      });
      console.log('[PERDCOMP] persist OK', { clienteId, facts: factsForPersistence.length });
    } catch (e: any) {
      console.error('[PERDCOMP] persist FAIL', { msg: e?.message, clienteId });
    }

    return NextResponse.json(resp);

  } catch (error: any) {
    console.error('[API /infosimples/perdcomp]', error);
    return NextResponse.json(
      {
        error: true,
        httpStatus: 502,
        httpStatusText: 'Bad Gateway',
        providerCode: null,
        providerMessage: error?.message || 'API error',
      },
      { status: 502 }
    );
  }
}
