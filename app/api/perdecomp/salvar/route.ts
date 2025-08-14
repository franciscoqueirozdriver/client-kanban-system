import { NextResponse } from 'next/server';
import { appendRows } from '../../../../lib/googleSheets';

const HEADER = [
  'Cliente_ID', 'Nome da Empresa', 'Perdcomp_ID', 'CNPJ', 'Tipo_Pedido', 'Situacao',
  'Periodo_Inicio', 'Periodo_Fim', 'Valor_Total', 'Numero_Processo', 'Data_Protocolo',
  'Ultima_Atualizacao', 'Quantidade_Receitas', 'Quantidade_Origens', 'Quantidade_DARFs',
  'URL_Comprovante_HTML', 'URL_Comprovante_PDF', 'Data_Consulta'
];

export async function POST(req: Request) {
  const { linhas } = await req.json();
  if (!Array.isArray(linhas) || linhas.some((l:any) => !Array.isArray(l) || l.length !== HEADER.length)) {
    return NextResponse.json({ ok: false, message: 'Formato inválido' }, { status: 400 });
  }
  try {
    await appendRows('PERDECOMP', linhas);
    return NextResponse.json({ ok: true, inseridos: linhas.length });
  } catch (err:any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
