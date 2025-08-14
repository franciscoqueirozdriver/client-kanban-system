import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import consultarPerdcomp from '@/lib/infosimples';

function gerarPerdcompId() {
  const now = new Date();
  const pad = (n:number)=>String(n).padStart(2,'0');
  const base = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(16).slice(2,6).toUpperCase();
  return `PDC-${base}-${rand}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const cnpj: string = String(body.cnpj || '').replace(/\D+/g,'');
  const { periodoInicio, periodoFim, force, clienteId = '', nomeCadastro = '' } = body;
  if (!cnpj) {
    return NextResponse.json({ ok:false, message:'CNPJ inválido' }, { status:400 });
  }
  try {
    if (!force) {
      const { rows } = await getSheetData('PERDECOMP');
      const linhas = rows.filter((r:any)=>{
        const c = String(r['CNPJ']||'').replace(/\D+/g,'');
        const data = r['Data_Consulta']||'';
        return c===cnpj && (!periodoInicio || data>=periodoInicio) && (!periodoFim || data<=periodoFim);
      });
      if (linhas.length>0) {
        const contagem:Record<string,number>={};
        let nomeDetectado='';
        const nomeCounts:Record<string,number>={};
        linhas.forEach((l:any)=>{
          const tipo=l['Tipo_Pedido']||'—';
          contagem[tipo]=(contagem[tipo]||0)+1;
          const n=l['Nome da Empresa']||'';
          if(n){nomeCounts[n]=(nomeCounts[n]||0)+1;}
        });
        const nomeEntry=Object.entries(nomeCounts).sort((a,b)=>b[1]-a[1])[0];
        if(nomeEntry) nomeDetectado=nomeEntry[0];
        return NextResponse.json({ ok:true, fonte:'planilha', linhas, quantidadePerdcomp: linhas.length, contagemPorTipoDocumento: contagem, nomeDetectado });
      }
    }
    const apiJson = await consultarPerdcomp({ cnpj });
    const arr = apiJson?.data?.[0]?.perdcomp || [];
    const nomeDetectado = arr.find((i:any)=>i?.solicitante)?.solicitante || '';
    const linhasParaSalvar:string[][]=[];
    const contagem:Record<string,number>={};
    arr.forEach((item:any)=>{
      if (!item) return;
      const tipo = item.tipo_documento || '—';
      const situacao = item.situacao || '';
      const solicitante = item.solicitante || nomeCadastro;
      const line = [
        clienteId,
        solicitante || nomeCadastro,
        gerarPerdcompId(),
        cnpj,
        tipo,
        situacao,
        '',
        '',
        '',
        '',
        '',
        '',
        '0',
        '0',
        '0',
        '',
        '',
        new Date().toISOString(),
        '',
      ];
      linhasParaSalvar.push(line);
      contagem[tipo]=(contagem[tipo]||0)+1;
    });
    return NextResponse.json({ ok:true, fonte:'api', header: apiJson?.header, nomeDetectado, quantidadePerdcomp: linhasParaSalvar.length, contagemPorTipoDocumento: contagem, linhasParaSalvar });
  } catch (err:any) {
    return NextResponse.json({ ok:false, message: err.message || 'Erro' }, { status:500 });
  }
}
