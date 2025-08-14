import { NextResponse } from 'next/server';
import { getSheetByNameCached } from '../../../../lib/googleSheets';
import { consultarPerdcomp } from '../../../../lib/infosimples';

function gerarId() {
  const now = new Date();
  const pad = (n:number)=>String(n).padStart(2,'0');
  const data = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).substring(2,6).toUpperCase();
  return `PDC-${data}-${rand}`;
}

export async function POST(req: Request) {
  const { cnpj, periodoInicio, periodoFim, force } = await req.json();
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  try {
    // verificar planilha
    const sheet = await getSheetByNameCached('PERDECOMP');
    const rows = (sheet.data.values || []) as string[][];
    const [header, ...data] = rows;
    const idx = {
      cnpj: header.indexOf('CNPJ'),
      inicio: header.indexOf('Periodo_Inicio'),
      fim: header.indexOf('Periodo_Fim'),
    };
    const existentes = data.filter(r => r[idx.cnpj] === cleanCnpj && (!periodoInicio || r[idx.fim] >= periodoInicio) && (!periodoFim || r[idx.inicio] <= periodoFim));
    if (existentes.length && !force) {
      return NextResponse.json({ ok: true, fonte: 'planilha', linhas: existentes });
    }

    // buscar cadastro
    const cadSheet = await getSheetByNameCached('layout_importacao_empresas');
    const cadRows = (cadSheet.data.values || []) as string[][];
    const [cadHeader, ...cadData] = cadRows;
    const cIdx = {
      clienteId: cadHeader.indexOf('Cliente_ID'),
      nome: cadHeader.indexOf('Nome da Empresa'),
      cnpj: cadHeader.indexOf('CNPJ Empresa'),
    };
    const cadastro = cadData.find(row => row[cIdx.cnpj]?.replace(/\D/g,'') === cleanCnpj) || [];
    const clienteId = cadastro[cIdx.clienteId] || '';
    const nomeEmpresa = cadastro[cIdx.nome] || '';

    const apiRes = await consultarPerdcomp({ cnpj: cleanCnpj, timeoutSeconds: 60 });
    const itensOrig = (apiRes?.data?.items || apiRes?.data || apiRes?.perdcomp || []);
    const nowIso = new Date().toISOString();
    const itens = Array.isArray(itensOrig) ? itensOrig.map((item:any)=>[
      clienteId,
      nomeEmpresa,
      gerarId(),
      cleanCnpj,
      item.tipo_pedido || '',
      item.situacao || '',
      periodoInicio || '',
      periodoFim || '',
      item.valor_total ?? '',
      item.numero_processo || '',
      item.data_protocolo || '',
      item.ultima_atualizacao || '',
      item.receitas?.length || 0,
      item.origens_credito?.length || 0,
      item.darfs?.length || 0,
      item.comprovante_html || '',
      item.comprovante_pdf || '',
      nowIso,
    ]) : [];
    return NextResponse.json({ ok: true, fonte: 'api', itens });
  } catch (err:any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
