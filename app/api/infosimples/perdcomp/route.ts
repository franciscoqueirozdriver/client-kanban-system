import { NextResponse } from 'next/server';
import { getPerdecompSheetCached } from '@/lib/googleSheets';
import { consultarPerdcomp } from '@/lib/infosimples';
import { z } from 'zod';

const cleanCnpj = (cnpj: string) => cnpj.replace(/\D/g, '');

const RequestBodySchema = z.object({
  cnpj: z.string().min(14, "CNPJ is required"),
  periodoInicio: z.string().optional(),
  periodoFim: z.string().optional(),
  force: z.boolean().optional().default(false),
});

// Basic date comparison, assuming YYYY-MM-DD format
const isWithinRange = (dateStr: string, start?: string, end?: string) => {
    if (!start || !end) return true; // No range provided
    const date = new Date(dateStr);
    const startDate = new Date(start);
    const endDate = new Date(end);
    return date >= startDate && date <= endDate;
};

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
    RequestBodySchema.parse(body);
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid request body', issues: (error as z.ZodError).issues }, { status: 400 });
  }

  const { cnpj, periodoInicio, periodoFim, force } = body;
  const cleanedCnpjValue = cleanCnpj(cnpj);

  // 1. Check spreadsheet if not forcing a new query
  if (!force) {
    try {
      const sheet = await getPerdecompSheetCached();
      const rows = sheet.data.values || [];
      if (rows.length > 1) {
        const header = rows[0];
        const data = rows.slice(1);
        const cnpjIdx = header.indexOf('CNPJ');
        const dataConsultaIdx = header.indexOf('Data_Consulta'); // Using Data_Consulta to filter by date range

        const existingLines = data.filter(row => {
          const rowCnpj = cleanCnpj(row[cnpjIdx] || '');
          const rowDate = row[dataConsultaIdx] || '';
          return rowCnpj === cleanedCnpjValue && isWithinRange(rowDate, periodoInicio, periodoFim);
        }).map(row => Object.fromEntries(header.map((key, i) => [key, row[i]]))); // Convert array to object

        if (existingLines.length > 0) {
          return NextResponse.json({ ok: true, fonte: 'planilha', linhas: existingLines });
        }
      }
    } catch (e) {
        // Log error but proceed to API call, as sheet might not exist yet
        console.error("Could not read from PERDECOMP sheet, proceeding to API.", e);
    }
  }

  // 2. Call Infosimples API
  try {
    const apiResult = await consultarPerdcomp({ cnpj: cleanedCnpjValue });

    // The requirement is to just return the items for the frontend to map and save.
    // No complex mapping is needed here, just pass it through.
    return NextResponse.json({ ok: true, fonte: 'api', itens: apiResult.data });

  } catch (error) {
    console.error(`Infosimples API error for CNPJ ${cnpj}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
