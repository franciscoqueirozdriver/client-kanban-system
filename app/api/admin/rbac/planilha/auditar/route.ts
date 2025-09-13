import { NextResponse } from 'next/server';
import { TARGET_SCHEMA } from '@/lib/rbac/targetSchema';
import { COMPAT_MAP } from '@/lib/rbac/compatMap';
import { getSpreadsheet, getHeader, createSheetIfMissing, appendMissingColumns } from '@/lib/googleSheets.ts';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to find similar columns based on the COMPAT_MAP
function findSimilarColumns(currentHeader: string[], targetHeader: readonly string[]): Record<string, string> {
  const similar: Record<string, string> = {};
  const flatCompatMap: Record<string, string> = {};

  // Flatten the compatibility map for easier lookup
  for (const [target, variations] of Object.entries(COMPAT_MAP)) {
    for (const variation of (variations as readonly string[])) {
      flatCompatMap[variation.toLowerCase()] = target;
    }
  }

  const currentHeaderLowerSet = new Set(currentHeader.map(h => String(h).toLowerCase()));
  const targetHeaderLowerSet = new Set(targetHeader.map(h => String(h).toLowerCase()));

  for (const currentH of currentHeader) {
    const currentHLower = currentH.toLowerCase();
    if (targetHeaderLowerSet.has(currentHLower)) {
      continue;
    }
    const mappedTarget = flatCompatMap[currentHLower];
    if (mappedTarget && targetHeaderLowerSet.has(mappedTarget.toLowerCase())) {
        similar[mappedTarget] = currentH;
    }
  }
  return similar;
}

export async function GET(request: Request) {
  // TODO: IMPORTANT SECURITY CHECK MISSING
  // The user prompt requested checking for a NextAuth session with role='admin'.
  // However, `next-auth` is not a dependency in package.json.
  // A proper authentication and authorization check MUST be implemented here.

  const { searchParams } = new URL(request.url);
  const fix = searchParams.get('fix') === '1';

  try {
    const spreadsheet = await getSpreadsheet();
    const existingSheets = spreadsheet.sheets?.map(s => s.properties?.title ?? '') ?? [];
    const report: Record<string, any> = {};

    // First pass: build the audit report based on the current state.
    for (const [sheetTitle, targetHeader] of Object.entries(TARGET_SCHEMA)) {
      const exists = existingSheets.includes(sheetTitle);

      let currentHeader: string[] = [];
      if (exists) {
        currentHeader = await getHeader(sheetTitle);
      }

      const currentHeaderSet = new Set(currentHeader.map(h => String(h).trim()));

      const similarColumns = findSimilarColumns(currentHeader, targetHeader);
      const similarColumnValues = new Set(Object.values(similarColumns).map(v => v.trim()));

      const missingColumns = targetHeader.filter(h => !currentHeaderSet.has(String(h).trim()) && !similarColumns[h]);
      const extraColumns = currentHeader.filter(h => !new Set(targetHeader).has(h) && !similarColumnValues.has(h));

      report[sheetTitle] = {
        exists,
        targetHeader,
        currentHeader,
        missingColumns,
        extraColumns,
        similarColumns,
      };
    }

    const actionsPerformed: string[] = [];
    const USE_ACTIONS_TAB = false; // As per user instruction

    if (fix) {
      for (const [sheetTitle, data] of Object.entries(report)) {
        if (sheetTitle === 'Permissoes_Acoes' && !USE_ACTIONS_TAB) {
          continue;
        }

        if (!data.exists) {
          await createSheetIfMissing(sheetTitle);
          actionsPerformed.push(`Created sheet: ${sheetTitle}`);
          // The sheet is new, so all target columns are missing and need to be written.
          await appendMissingColumns(sheetTitle, data.targetHeader);
          actionsPerformed.push(`Wrote header for new sheet: ${sheetTitle}`);
        } else if (data.missingColumns.length > 0) {
          // The sheet exists, but some columns are missing. Append them.
          await appendMissingColumns(sheetTitle, data.missingColumns);
          actionsPerformed.push(`Appended ${data.missingColumns.length} columns to ${sheetTitle}: ${data.missingColumns.join(', ')}`);
        }
      }
      // After fixing, re-run the audit to get the final state for the report
      if (actionsPerformed.length > 0) {
        const finalSpreadsheet = await getSpreadsheet();
        const finalExistingSheets = finalSpreadsheet.sheets?.map(s => s.properties?.title ?? '') ?? [];
        for (const [sheetTitle, targetHeader] of Object.entries(TARGET_SCHEMA)) {
            const exists = finalExistingSheets.includes(sheetTitle);
            let currentHeader: string[] = [];
            if (exists) {
                currentHeader = await getHeader(sheetTitle);
            }
            const currentHeaderSet = new Set(currentHeader.map(h => String(h).trim()));
            const similarColumns = findSimilarColumns(currentHeader, targetHeader);
            const similarColumnValues = new Set(Object.values(similarColumns).map(v => v.trim()));
            const missingColumns = targetHeader.filter(h => !currentHeaderSet.has(String(h).trim()) && !similarColumns[h]);
            const extraColumns = currentHeader.filter(h => !new Set(targetHeader).has(h) && !similarColumnValues.has(h));
            report[sheetTitle] = { ...report[sheetTitle], currentHeader, missingColumns, extraColumns, similarColumns, exists };
        }
      }
    }

    const reportDir = path.join(process.cwd(), 'docs', 'rbac');
    await fs.mkdir(reportDir, { recursive: true });

    await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.json'), JSON.stringify({ report, actionsPerformed }, null, 2));

    let csvContent = "aba;exists;missing;extra;similar;actions\n";
    for (const [sheet, data] of Object.entries(report)) {
        const missing = data.missingColumns.join(', ');
        const extra = data.extraColumns.join(', ');
        const similar = Object.entries(data.similarColumns).map(([k, v]) => `${k}<->${v}`).join(', ');
        const actions = actionsPerformed.filter(a => a.includes(sheet)).join(', ');
        csvContent += `${sheet};${data.exists};"${missing}";"${extra}";"${similar}";"${actions}"\n`;
    }
    await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.csv'), csvContent);

    let mdContent = "# Relatório de Diferenças da Planilha\n\n";
    if (actionsPerformed.length > 0) {
        mdContent += "## Ações Realizadas\n\n";
        actionsPerformed.forEach(action => { mdContent += `- ${action}\n`; });
        mdContent += "\n";
    }
    mdContent += "# Status da Planilha\n\n";
    for (const [sheet, data] of Object.entries(report)) {
        mdContent += `## Aba: **${sheet}**\n\n`;
        mdContent += `- **Existe:** ${data.exists ? 'Sim' : 'Não'}\n`;
        mdContent += `- **Colunas Faltando (${data.missingColumns.length}):** ${data.missingColumns.length > 0 ? `\`${data.missingColumns.join('`, `')}\`` : 'Nenhuma'}\n`;
        mdContent += `- **Colunas Extras (${data.extraColumns.length}):** ${data.extraColumns.length > 0 ? `\`${data.extraColumns.join('`, `')}\`` : 'Nenhuma'}\n`;
        if (Object.keys(data.similarColumns).length > 0) {
            mdContent += `- **Colunas Similares (sugestão):**\n`;
            for(const [k,v] of Object.entries(data.similarColumns)) {
              mdContent += `  - \`${k}\` (no schema) pode ser \`${v}\` (na planilha)\n`;
            }
        }
        mdContent += "\n";
    }
    await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.md'), mdContent);

    return NextResponse.json({
      message: fix ? 'Fix complete. Reports generated in docs/rbac/' : 'Audit complete. Reports generated in docs/rbac/',
      actionsPerformed,
      report,
    });

  } catch (error: any) {
    console.error('Error during spreadsheet audit:', error);
    return NextResponse.json({ error: 'Failed to audit spreadsheet', details: error.message }, { status: 500 });
  }
}
