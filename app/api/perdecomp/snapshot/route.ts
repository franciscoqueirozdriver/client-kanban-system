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
  cliente_id?: string;
  nomeEmpresa?: string;
  Nome_da_Empresa?: string;
  nome_da_empresa?: string;
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
  error?: string;
  // allow other props from snapshot
  [key: string]: unknown;
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

  // snake_case fallback
  const idxCliente = col('cliente_id');
  const idxCnpj = col('cnpj');
  const idxQtd = col('quantidade_perdcomp');
  const idxHtml = col('url_comprovante_html');
  const idxData = col('data_consulta');
  const idxQtdDcomp = col('qtd_perdcomp_dcomp');
  const idxQtdRest = col('qtd_perdcomp_rest');
  const idxQtdRessarc = col('qtd_perdcomp_ressarc');
  const idxQtdCancel = col('qtd_perdcomp_cancel');

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

    // Normalize inputs
    const rawCnpj = body.cnpj || '';
    const nomeEmpresa = body.nome_da_empresa || body.nomeEmpresa || body.Nome_da_Empresa;
    let clienteId = body.cliente_id || body.clienteId || body.Cliente_ID;

    // Strict check for CNPJ presence
    if (!rawCnpj) {
       return NextResponse.json({ error: 'CNPJ is required' }, { status: 400 });
    }

    const cnpj = onlyDigits(rawCnpj).padStart(14, '0');

    // --- FALLBACK LOGIC FOR MISSING CLIENTE_ID ---
    if (!clienteId) {
      try {
        const foundId = await findClienteIdByCnpj(cnpj);
        if (foundId) {
          clienteId = foundId;
        } else {
          console.warn('[perdecomp/snapshot] Missing cliente_id and could not resolve via CNPJ', { cnpj });
          // Proceed without clienteId (will fall back to sheet logic if possible, or empty)
        }
      } catch (e) {
        console.error('[perdecomp/snapshot] Error resolving clienteId from CNPJ', e);
      }
    }

    // 1. Try to load from Snapshot
    if (clienteId) {
      try {
        let snapshotCard = await loadSnapshotCard({ clienteId });

        if (!snapshotCard) {
          // Double check if we might have a different ID for this CNPJ
          const resolvedId = await findClienteIdByCnpj(cnpj);
          if (resolvedId && resolvedId !== clienteId) {
             console.warn('[perdecomp/snapshot] cliente_id mismatch/fallback triggered', {
               provided: clienteId,
               resolved: resolvedId,
               cnpj
             });
             snapshotCard = await loadSnapshotCard({ clienteId: resolvedId });
             clienteId = resolvedId;
          }
        }

        if (snapshotCard) {
          // Extract data safely with strict typing where possible
          const resumo = snapshotCard?.resumo ?? snapshotCard?.perdcompResumo ?? {};
          const mappedCount = snapshotCard?.mappedCount ?? (Array.isArray(snapshotCard?.perdcomp) ? snapshotCard.perdcomp.length : 0);
          const totalPerdcomp = snapshotCard?.total_perdcomp ?? resumo?.total ?? mappedCount;
          const siteReceipt = snapshotCard?.site_receipt ?? snapshotCard?.header?.site_receipt ?? null;
          const lastConsultation = snapshotCard?.header?.requested_at ?? snapshotCard?.requestedAt ?? null;
          const primeiro = snapshotCard?.primeiro ?? (Array.isArray(snapshotCard?.perdcomp) && snapshotCard.perdcomp[0]) ?? null;

          // Reconstruct perdcompCodigos if missing, using the array of items
          const firstPerdcompArray = Array.isArray(snapshotCard?.perdcomp)
            ? snapshotCard.perdcomp
            : [];
          let perdcompCodigos = snapshotCard?.perdcompCodigos ?? [];

          if (
            (!perdcompCodigos || perdcompCodigos.length === 0) &&
            Array.isArray(firstPerdcompArray)
          ) {
            perdcompCodigos = firstPerdcompArray
              .map((item: any) =>
                item?.perdcomp ??
                item?.Perdcomp_Numero ??
                item?.numero ??
                null,
              )
              .filter(
                (x: any): x is string =>
                  typeof x === 'string' && x.trim().length > 0,
              );
          }

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
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('SNAPSHOT_READ_FAIL', {
          clienteId,
          error: msg
        });
      }
    }

    // 2. Fallback to old Sheet logic
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

    // 3. No data found (Empty) - Return 200 OK with empty status instead of 404/500
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

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[API /perdecomp/snapshot]', err);
    return NextResponse.json(
      {
        error: true,
        message: err.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
