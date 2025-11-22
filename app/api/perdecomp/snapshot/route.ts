import { NextResponse } from 'next/server';
import { loadSnapshotCard } from '@/lib/perdecomp-persist';
import { getSheetsClient } from '@/lib/googleSheets';

export const runtime = 'nodejs';

// Helper to get fallback data from the old PERDECOMP sheet if snapshot is missing
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
    const { cnpj, nomeEmpresa } = body;
    // Accept both casings for compatibility
    const clienteId = body.clienteId || body.Cliente_ID;

    if (!cnpj) {
       return NextResponse.json({ error: 'CNPJ is required' }, { status: 400 });
    }

    if (!clienteId) {
       return NextResponse.json({ error: 'clienteId is required' }, { status: 400 });
    }

    // 1. Try to load from Snapshot
    try {
      const snapshotCard = await loadSnapshotCard({ clienteId });

      if (snapshotCard) {
        // Extract data from the rich snapshot card
        const resumo = snapshotCard?.resumo ?? snapshotCard?.perdcompResumo ?? {};
        const mappedCount = snapshotCard?.mappedCount ?? (Array.isArray(snapshotCard?.perdcomp) ? snapshotCard.perdcomp.length : 0);
        const totalPerdcomp = snapshotCard?.total_perdcomp ?? resumo?.total ?? mappedCount;
        const siteReceipt = snapshotCard?.site_receipt ?? snapshotCard?.header?.site_receipt ?? null;
        const lastConsultation = snapshotCard?.header?.requested_at ?? snapshotCard?.requestedAt ?? null;
        const primeiro = snapshotCard?.primeiro ?? (Array.isArray(snapshotCard?.perdcomp) && snapshotCard.perdcomp[0]) ?? null;
        const perdcompCodigos = snapshotCard?.perdcompCodigos ?? [];

        return NextResponse.json({
          ok: true,
          fonte: 'perdecomp_snapshot',
          mappedCount,
          total_perdcomp: totalPerdcomp,
          perdcompResumo: resumo,
          perdcompCodigos,
          site_receipt: siteReceipt,
          primeiro,
          header: {
            requested_at: lastConsultation,
            cnpj,
            nomeEmpresa,
            clienteId,
          },
          ...snapshotCard,
        });
      }
    } catch (error) {
      console.warn('SNAPSHOT_READ_FAIL', {
        clienteId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 2. Fallback to old Sheet logic (read-only)
    const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
    if (fallback) {
      const { quantidade, dcomp, rest, ressarc, canc, site_receipt, requested_at } = fallback;
      const resumo = {
        total: dcomp + rest + ressarc + canc,
        totalSemCancelamento: quantidade || dcomp + rest + ressarc,
        canc,
        porFamilia: {
          DCOMP: dcomp,
          REST: rest,
          RESSARC: ressarc,
          CANC: canc,
          DESCONHECIDO: 0
        },
        porNaturezaAgrupada: {
          '1.3/1.7': dcomp,
          '1.2/1.6': rest,
          '1.1/1.5': ressarc,
        },
      };

      return NextResponse.json({
        ok: true,
        fonte: 'planilha_fallback',
        perdcompResumo: resumo,
        total_perdcomp: resumo.total,
        perdcompCodigos: [],
        site_receipt,
        header: { requested_at },
      });
    }

    // 3. No data found
    return NextResponse.json({
        ok: true,
        fonte: 'empty',
        mappedCount: 0,
        total_perdcomp: 0,
        perdcompResumo: {
            total: 0,
            totalSemCancelamento: 0,
            canc: 0,
            porFamilia: { DCOMP: 0, REST: 0, RESSARC: 0, CANC: 0, DESCONHECIDO: 0 },
            porNaturezaAgrupada: {},
        },
        perdcompCodigos: [],
        site_receipt: null,
        header: { requested_at: null },
    });

  } catch (error: any) {
    console.error('[API /perdecomp/snapshot]', error);
    return NextResponse.json(
      {
        error: true,
        message: error?.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
