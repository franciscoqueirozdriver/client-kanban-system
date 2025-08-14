// @ts-nocheck
import { NextResponse } from 'next/server';
import { getSheetByNameCached } from '../../../../lib/googleSheets';
import { consultarPerdcomp } from '../../../../lib/infosimples';

const HEADERS = [
  'Cliente_ID',
  'Nome da Empresa',
  'Perdcomp_ID',
  'CNPJ',
  'Tipo_Pedido',
  'Situacao',
  'Periodo_Inicio',
  'Periodo_Fim',
  'Valor_Total',
  'Numero_Processo',
  'Data_Protocolo',
  'Ultima_Atualizacao',
  'Quantidade_Receitas',
  'Quantidade_Origens',
  'Quantidade_DARFs',
  'URL_Comprovante_HTML',
  'URL_Comprovante_PDF',
  'Data_Consulta',
];
const INDEX = HEADERS.reduce((acc, h, i) => { acc[h] = i; return acc; }, {} as any);

function normalizeDate(d: string) {
  if (!d) return '';
  if (d.length === 7) return d;
  return d.slice(0, 10);
}

function generatePerdcompId() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PDC-${datePart}-${rand}`;
}

function aggregate(rows: any[]) {
  let quantidade = rows.length;
  let valorTotal = 0;
  const valorPorTipo: any = {};
  const comprovantes: any[] = [];
  let ultima = '';
  rows.forEach((row) => {
    const valor = parseFloat(row[INDEX['Valor_Total']] || 0);
    valorTotal += valor;
    const tipo = row[INDEX['Tipo_Pedido']] || '';
    if (tipo) valorPorTipo[tipo] = (valorPorTipo[tipo] || 0) + valor;
    const html = row[INDEX['URL_Comprovante_HTML']] || '';
    const pdf = row[INDEX['URL_Comprovante_PDF']] || '';
    if (html || pdf) comprovantes.push({ html, pdf });
    const dc = row[INDEX['Data_Consulta']] || '';
    if (dc && dc > ultima) ultima = dc;
  });
  return { quantidade, valorPorTipo, valorTotal, comprovantes, ultimaConsulta: ultima };
}

export async function POST(req: Request) {
  const { cnpj, periodoInicio, periodoFim, force } = await req.json();
  const cnpjDigits = (cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return NextResponse.json({ ok: false, message: 'CNPJ inválido' }, { status: 400 });
  }

  if (!force) {
    try {
      const sheet = await getSheetByNameCached('PERDECOMP');
      const rows = sheet.data.values || [];
      const [header, ...dataRows] = rows;
      const matches = dataRows.filter((r: any[]) => {
        const c = r[INDEX['CNPJ']] || '';
        const pi = r[INDEX['Periodo_Inicio']] || '';
        const pf = r[INDEX['Periodo_Fim']] || '';
        return c === cnpjDigits && pi >= periodoInicio && pf <= periodoFim;
      });
      if (matches.length) {
        return NextResponse.json({ ok: true, fonte: 'planilha', linhas: matches, agregado: aggregate(matches) });
      }
    } catch (err) {
      console.error('sheet read error', err);
    }
  }

  try {
    const apiRes = await consultarPerdcomp({ cnpj: cnpjDigits, periodoInicio, periodoFim });
    const items = apiRes?.items || apiRes?.data || [];

    let clienteId = '';
    let nomeEmpresa = '';
    try {
      const cadSheet = await getSheetByNameCached('layout_importacao_empresas');
      const cadRows = cadSheet.data.values || [];
      const [cadHeader, ...cadData] = cadRows;
      const idxId = cadHeader.indexOf('Cliente_ID');
      const idxNome = cadHeader.indexOf('Nome da Empresa');
      const idxCnpj = cadHeader.indexOf('CNPJ Empresa');
      const found = cadData.find((r: any[]) => (r[idxCnpj] || '').replace(/\D/g, '') === cnpjDigits);
      if (found) {
        clienteId = idxId >= 0 ? found[idxId] : '';
        nomeEmpresa = idxNome >= 0 ? found[idxNome] : '';
      }
    } catch (e) {
      console.error('cadastro lookup error', e);
    }

    const nowIso = new Date().toISOString();
    const linhas = items.map((item: any) => [
      clienteId,
      nomeEmpresa,
      generatePerdcompId(),
      cnpjDigits,
      item.tipo_pedido || item.tipo || '',
      item.situacao || '',
      normalizeDate(item.periodo_inicio || periodoInicio),
      normalizeDate(item.periodo_fim || periodoFim),
      item.valor_total || item.valor || '',
      item.numero_processo || '',
      item.data_protocolo || '',
      item.ultima_atualizacao || '',
      item.receitas ? item.receitas.length : 0,
      item.origens_credito ? item.origens_credito.length : 0,
      item.darfs ? item.darfs.length : 0,
      item.comprovante_html || item?.site_receipts?.html || '',
      item.comprovante_pdf || item?.site_receipts?.pdf || '',
      nowIso,
    ]);

    return NextResponse.json({ ok: true, fonte: 'api', linhas, agregado: aggregate(linhas) });
  } catch (err) {
    console.error('infosimples error', err);
    return NextResponse.json({ ok: false, message: 'Erro na consulta' }, { status: 500 });
  }
}
