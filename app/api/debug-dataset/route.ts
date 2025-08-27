import { NextResponse } from 'next/server';
import { getSheetData } from '../../../lib/googleSheets.js';
import { execSync } from 'child_process';

const SHEET_NAME = 'Sheet1';

export async function GET() {
  try {
    const { headers, rows } = await getSheetData(SHEET_NAME);

    const totalLinhasLidas = rows.length;
    const amostraPrimeirasLinhas = rows.slice(0, 10);
    const camposDetectados = headers;

    const idCounts = new Map<string, number>();
    const empresas = new Set<string>();

    rows.forEach(row => {
      const id = row['Cliente_ID'];
      if (id) {
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      }
      const empresa = row['Organização - Nome'] || row['Nome da Empresa'] || row['Nome do Lead'];
      if (empresa) empresas.add(empresa);
    });

    const contagemIdsUnicos = idCounts.size;
    const idsOcorrenciaUnica = Array.from(idCounts.values()).filter(v => v === 1).length;
    const contagemEmpresasUnicas = empresas.size;

    const limitesEncontrados = {
      temSlice: false,
      temLimit: false,
      temRangeFechado: false,
      detalhes: [] as string[],
    };

    const filtrosAtivosPorPadrao = {
      segmento: '',
      uf: '',
      dataRange: '',
    };

    const commitAtual = execSync('git rev-parse HEAD').toString().trim();

    return NextResponse.json({
      totalLinhasLidas,
      amostraPrimeirasLinhas,
      camposDetectados,
      contagemIdsUnicos,
      idsOcorrenciaUnica,
      contagemEmpresasUnicas,
      limitesEncontrados,
      filtrosAtivosPorPadrao,
      commitAtual,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
