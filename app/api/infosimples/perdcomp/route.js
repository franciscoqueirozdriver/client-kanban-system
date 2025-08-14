import { NextResponse } from 'next/server';
import { consultarPerdcomp } from '../../../../lib/infosimples';
import { getPerdecompSheetCached, getPerdecompHeaderInfoCached, PERDECOMP_COLUMN_MAP } from '../../../../lib/googleSheets';

function parseDate(dateString) {
    // Handles YYYY-MM-DD and YYYY-MM
    const parts = dateString.split('-').map(Number);
    if (parts.length === 2) {
        return new Date(parts[0], parts[1] - 1, 1);
    }
    return new Date(dateString);
}

export async function POST(request) {
    const { cnpj, periodoInicio, periodoFim, force = false } = await request.json();

    if (!cnpj || !periodoInicio || !periodoFim) {
        return NextResponse.json({ message: 'Missing required parameters: cnpj, periodoInicio, periodoFim' }, { status: 400 });
    }

    const cnpjDigits = cnpj.replace(/\D/g, '');

    // 1. Check spreadsheet first, unless force=true
    if (!force) {
        try {
            const [sheet, headerInfo] = await Promise.all([
                getPerdecompSheetCached(),
                getPerdecompHeaderInfoCached()
            ]);

            const rows = sheet.data.values || [];
            const [header, ...dataRows] = rows;

            if (header) {
                const { indexMap } = headerInfo;
                const cnpjIndex = indexMap[PERDECOMP_COLUMN_MAP.CNPJ];
                const dataConsultaIndex = indexMap[PERDECOMP_COLUMN_MAP.Data_Consulta];

                const requestStartDate = parseDate(periodoInicio);
                const requestEndDate = parseDate(periodoFim);

                const existingLines = dataRows.filter(row => {
                    const rowCnpj = (row[cnpjIndex] || '').replace(/\D/g, '');
                    if (rowCnpj !== cnpjDigits) return false;

                    const consultaDate = new Date(row[dataConsultaIndex]);
                    // A simple check to see if the consultation date is within the requested period.
                    // A more precise check would be against Periodo_Inicio/Periodo_Fim of the PERDCOMP itself.
                    // Sticking to Data_Consulta for now as per prompt's focus on re-querying.
                    return consultaDate >= requestStartDate && consultaDate <= requestEndDate;
                });

                if (existingLines.length > 0) {
                    const mappedLines = existingLines.map(row => {
                        const lineData = {};
                        for (const key in PERDECOMP_COLUMN_MAP) {
                            const headerName = PERDECOMP_COLUMN_MAP[key];
                            const headerIndex = indexMap[headerName];
                            if (headerIndex !== undefined) {
                                lineData[key] = row[headerIndex] || '';
                            }
                        }
                        return lineData;
                    });
                    return NextResponse.json({ ok: true, fonte: 'planilha', linhas: mappedLines });
                }
            }
        } catch (error) {
            console.error('Error checking spreadsheet for PERDCOMP data:', error);
            // Don't fail, proceed to API call
        }
    }

    // 2. If no data in spreadsheet or force=true, call API
    try {
        const apiData = await consultarPerdcomp({ cnpj: cnpjDigits });

        if (apiData?.data?.length > 0) {
            // The prompt says "Não salvar aqui; apenas retornar".
            // The mapping to the 18 columns will be done on the client before calling the save route.
            // Here we just return the raw items.
            return NextResponse.json({ ok: true, fonte: 'api', itens: apiData.data });
        } else {
            return NextResponse.json({ ok: true, fonte: 'api', itens: [] });
        }

    } catch (error) {
        console.error('Error calling Infosimples API:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
