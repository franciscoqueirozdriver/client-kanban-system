import { NextResponse } from 'next/server';
import { loadSnapshotCard, findClienteIdByCnpj } from '@/lib/perdecomp-persist';
import { getSheetsClient } from '@/lib/googleSheets';
import { onlyDigits } from '@/utils/cnpj';

export const runtime = 'nodejs';

// --- Type Definitions ---
interface PerdecompSnapshotRequest {
  cnpj: string;
  clienteId?: string;
  Cliente_ID?: string;
  nomeEmpresa?: string;
  Nome_da_Empresa?: string;
}

interface PerdcompResumo {
  total: number;
  totalSemCancelamento: number;
  canc: number;
  porFamilia: {
    DCOMP: number;
    REST: number;
    RESSARC: number;
    CANC: number;
    DESCONHECIDO: number;
  };
  porNaturezaAgrupada: Record<string, number>;
}

interface PerdecompSnapshotResponse {
  ok: boolean;
  fonte: 'perdecomp_snapshot' | 'planilha_fallback' | 'empty';
  mappedCount: number;
  total_perdcomp: number;
  perdcompResumo: PerdcompResumo | null;
  perdcompCodigos: string[];
  site_receipt: string | null;
  primeiro?: any;
  header: {
    requested_at: string | null;
    cnpj?: string;
    nomeEmpresa?: string;
    clienteId?: string;
  };
  [key: string]: any; // Allow extra fields from snapshot
}

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
  const safeRows = Array.isArray(rows) ? rows : [];

  const idxCliente = col('Cliente_ID');
  const idxCnpj = col('CNPJ');
  const idxQtd = col('Quantidade_PERDCOMP');
  const idxHtml = col('URL_Comprovante_HTML');
  const idxData = col('Data_Consulta');
  const idxQtdDcomp = col('Qtd_PERDCOMP_DCOMP');
  const idxQtdRest = col('Qtd_PERDCOMP_REST');
  const idxQtdRessarc = col('Qtd_PERDCOMP_RESSARC');
  const idxQtdCancel = col('Qtd_PERDCOMP_CANCEL');

  const match = safeRows.find(
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
    const rawBody = await request.json().catch(() => ({}));
    const body = rawBody as PerdecompSnapshotRequest;

    const rawCnpj = body.cnpj;

    // Derived values
    const nomeEmpresa = body.nomeEmpresa || body.Nome_da_Empresa;
    let clienteId = body.clienteId || body.Cliente_ID;

    // Strict CNPJ validation logic can be relaxed slightly, but we need digits.
    // If no CNPJ provided at all, that's a bad request.
    if (!rawCnpj) {
       return NextResponse.json({ error: 'CNPJ is required' }, { status: 400 });
    }

    // Force 14-digit padding
    const cnpj = onlyDigits(rawCnpj).padStart(14, '0');

    // --- FALLBACK LOGIC FOR MISSING CLIENTE_ID ---
    // If clienteId is missing, try to find it by CNPJ in the snapshot index
    if (!clienteId) {
      try {
        const foundId = await findClienteIdByCnpj(cnpj);
        if (foundId) {
          clienteId = foundId;
        } else {
          console.warn('[perdecomp/snapshot] Missing clienteId and could not resolve via CNPJ', { cnpj });
          // If still not found, we will proceed to fallback sheet logic which uses CNPJ
        }
      } catch (e) {
        console.error('[perdecomp/snapshot] Error resolving clienteId from CNPJ', e);
      }
    }

    // 1. Try to load from Snapshot (if we have a clienteId)
    if (clienteId) {
      try {
        let snapshotCard = await loadSnapshotCard({ clienteId });

        // Double check: if not found by ID, maybe ID was wrong but CNPJ is right?
        // This handles cases where frontend sends an outdated ID.
        if (!snapshotCard) {
          const resolvedId = await findClienteIdByCnpj(cnpj);
          if (resolvedId && resolvedId !== clienteId) {
             console.warn('[perdecomp/snapshot] clienteId mismatch/fallback triggered', {
               provided: clienteId,
               resolved: resolvedId,
               cnpj
             });
             snapshotCard = await loadSnapshotCard({ clienteId: resolvedId });
             // Use the correct ID for consistency
             clienteId = resolvedId;
          }
        }

        if (snapshotCard) {
          // Extract data safely
          const resumo = snapshotCard?.resumo ?? snapshotCard?.perdcompResumo ?? {};
          const mappedCount = snapshotCard?.mappedCount ?? (Array.isArray(snapshotCard?.perdcomp) ? snapshotCard.perdcomp.length : 0);
          const totalPerdcomp = snapshotCard?.total_perdcomp ?? resumo?.total ?? mappedCount;
          const siteReceipt = snapshotCard?.site_receipt ?? snapshotCard?.header?.site_receipt ?? null;
          const lastConsultation = snapshotCard?.header?.requested_at ?? snapshotCard?.requestedAt ?? null;
          const primeiro = snapshotCard?.primeiro ?? (Array.isArray(snapshotCard?.perdcomp) && snapshotCard.perdcomp[0]) ?? null;
          const perdcompCodigos = snapshotCard?.perdcompCodigos ?? [];

          const response: PerdecompSnapshotResponse = {
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
          };

          return NextResponse.json(response);
        }
      } catch (error) {
        console.warn('SNAPSHOT_READ_FAIL', {
          clienteId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 2. Fallback to old Sheet logic (read-only)
    // Uses CNPJ primarily if clienteId lookup failed or snapshot missing
    const fallback = await getLastPerdcompFromSheet({ cnpj, clienteId });
    if (fallback) {
      const { quantidade, dcomp, rest, ressarc, canc, site_receipt, requested_at } = fallback;

      const resumo: PerdcompResumo = {
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

      const response: PerdecompSnapshotResponse = {
        ok: true,
        fonte: 'planilha_fallback',
        mappedCount: 0,
        total_perdcomp: resumo.total,
        perdcompResumo: resumo,
        perdcompCodigos: [],
        site_receipt,
        header: { requested_at },
      };

      return NextResponse.json(response);
    }

    // 3. No data found (Empty)
    const emptyResponse: PerdecompSnapshotResponse = {
        ok: true,
        fonte: 'empty',
        mappedCount: 0,
        total_perdcomp: 0,
        perdcompResumo: null,
        perdcompCodigos: [],
        site_receipt: null,
        header: { requested_at: null },
    };

    return NextResponse.json(emptyResponse);

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
