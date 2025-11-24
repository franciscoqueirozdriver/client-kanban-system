import { NextResponse } from 'next/server';
import { updateRowByIndex } from '@/lib/sheets';
import { _findRowNumberByClienteId, getSheetData } from '@/lib/sheets-helpers';
import { onlyDigits } from '@/utils/cnpj-matriz';
import { refreshPerdcompData } from '@/lib/perdecomp-service';

export const runtime = 'nodejs';

const SHEETS = [
  'Leads Exact Spotter',
  'layout_importacao_empresas',
  'Sheet1',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept both snake_case (preferred) and camelCase (legacy compatibility)
    const clienteId = body.cliente_id || body.clienteId;
    const cnpj = body.cnpj;
    const force = body.force === true;
    const { data_inicio, data_fim, nome_da_empresa, nomeEmpresa } = body;

    if (!clienteId || !cnpj) {
      return NextResponse.json(
        { error: 'clienteId e cnpj são obrigatórios' },
        { status: 400 },
      );
    }

    const cnpjNum = onlyDigits(String(cnpj));
    if (cnpjNum.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ deve conter 14 dígitos' },
        { status: 400 },
      );
    }

    const results: Array<Record<string, any>> = [];

    // 1. Update Sheets (CNPJ persistence)
    const updateSheet = async (sheetName: string) => {
      const rowIndex = await _findRowNumberByClienteId(sheetName, clienteId);
      if (rowIndex === -1) {
        return { sheetName, updated: 0, reason: 'Cliente_ID não encontrado' };
      }

      const { headers } = await getSheetData(sheetName);
      const updates: Record<string, any> = {};

      // Support both legacy PascalCase and new snake_case headers
      if (headers.includes('CNPJ_Empresa')) updates.CNPJ_Empresa = cnpjNum;
      if (headers.includes('cnpj_empresa')) updates.cnpj_empresa = cnpjNum;

      if (headers.includes('CNPJ_Normalizado')) updates.CNPJ_Normalizado = cnpjNum;
      if (headers.includes('cnpj_normalizado')) updates.cnpj_normalizado = cnpjNum;

      if (headers.includes('CNPJ_Matriz')) {
        updates.CNPJ_Matriz = `${cnpjNum.slice(0, 8)}0001${cnpjNum.slice(-2)}`;
      }
      if (headers.includes('cnpj_matriz')) {
        updates.cnpj_matriz = `${cnpjNum.slice(0, 8)}0001${cnpjNum.slice(-2)}`;
      }

      if (headers.includes('CNPJ_Raiz')) updates.CNPJ_Raiz = cnpjNum.slice(0, 8);
      if (headers.includes('cnpj_raiz')) updates.cnpj_raiz = cnpjNum.slice(0, 8);

      if (headers.includes('Is_Matriz')) {
        updates.Is_Matriz = cnpjNum.slice(8, 12) === '0001' ? 'TRUE' : 'FALSE';
      }
      if (headers.includes('is_matriz')) {
        updates.is_matriz = cnpjNum.slice(8, 12) === '0001' ? 'TRUE' : 'FALSE';
      }

      if (Object.keys(updates).length === 0) {
        return { sheetName, updated: 0, reason: 'Sem colunas de CNPJ nesta aba' };
      }

      await updateRowByIndex({ sheetName, rowIndex, updates });
      return { sheetName, updated: Object.keys(updates).length };
    };

    for (const sheet of SHEETS) {
      try {
        results.push(await updateSheet(sheet));
      } catch (error: any) {
        results.push({
          sheetName: sheet,
          error: error?.message || 'erro ao atualizar',
        });
      }
    }

    // 2. Refresh PER/DCOMP Data (if forced)
    let perdcompResult: any = null;
    if (force) {
      console.info('[sheets/cnpj] Force refresh requested. Triggering PER/DCOMP update.', { clienteId, cnpj: cnpjNum });
      try {
        perdcompResult = await refreshPerdcompData({
          clienteId,
          cnpj: cnpjNum,
          startDate: data_inicio,
          endDate: data_fim,
          nomeEmpresa: nome_da_empresa || nomeEmpresa || 'Empresa Desconhecida',
        });
      } catch (error: any) {
        console.error('[sheets/cnpj] Failed to refresh PER/DCOMP data', error);
        // We don't fail the whole request, but we report the error
        perdcompResult = { error: error?.message || 'Falha na consulta Infosimples' };
      }
    }

    return NextResponse.json({ ok: true, results, perdcompResult }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao persistir CNPJ' },
      { status: 500 },
    );
  }
}
