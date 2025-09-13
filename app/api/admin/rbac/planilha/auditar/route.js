import { NextResponse } from 'next/server';
import { TARGET_SCHEMA } from '@/lib/rbac/targetSchema';
import { COMPAT_MAP } from '@/lib/rbac/compatMap';
import { getSpreadsheet, getHeader, createSheetIfMissing, appendMissingColumns } from '@/lib/googleSheets';
import { promises as fs } from 'fs';
import path from 'path';

function findSimilarColumns(currentHeader, targetHeader) {
  const similar = {};
  const flatCompatMap = {};
  for (const [target, variations] of Object.entries(COMPAT_MAP)) {
    for (const variation of variations) {
      flatCompatMap[String(variation).toLowerCase()] = target;
    }
  }
  const targetLower = new Set(targetHeader.map(h => String(h).toLowerCase()));
  for (const current of currentHeader) {
    const lower = String(current).toLowerCase();
    if (targetLower.has(lower)) continue;
    const mapped = flatCompatMap[lower];
    if (mapped && targetLower.has(mapped.toLowerCase())) {
      similar[mapped] = current;
    }
  }
  return similar;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fix = searchParams.get('fix') === '1';
  const isDev = process.env.NODE_ENV !== 'production';

  if (fix && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const spreadsheet = await getSpreadsheet();
    const existingSheets = spreadsheet.sheets?.map(s => s.properties?.title ?? '') ?? [];
    const report = {};

    for (const [sheetTitle, targetHeader] of Object.entries(TARGET_SCHEMA)) {
      const exists = existingSheets.includes(sheetTitle);
      let currentHeader = [];
      if (exists) {
        currentHeader = await getHeader(sheetTitle);
      }
      const currentSet = new Set(currentHeader.map(h => String(h).trim()));
      const similarColumns = findSimilarColumns(currentHeader, targetHeader);
      const similarValues = new Set(Object.values(similarColumns).map(v => String(v).trim()));
      const missingColumns = targetHeader.filter(h => !currentSet.has(String(h).trim()) && !similarColumns[h]);
      const extraColumns = currentHeader.filter(h => !new Set(targetHeader).has(h) && !similarValues.has(h));
      report[sheetTitle] = { exists, targetHeader, currentHeader, missingColumns, extraColumns, similarColumns };
    }

    const actionsPerformed = [];
    const USE_ACTIONS_TAB = false; // As per user instruction

    if (fix) {
      // NUNCA renomear, apagar, mover ou sobrescrever colunas/abas existentes.
      // SOMENTE criar abas faltantes e anexar colunas faltantes ao final.
      // Idempotente: rodadas múltiplas não duplicam colunas.
      for (const [sheetTitle, data] of Object.entries(report)) {
        if (sheetTitle === 'Permissoes_Acoes' && !USE_ACTIONS_TAB) continue;
        if (!data.exists) {
          await createSheetIfMissing(sheetTitle);
          actionsPerformed.push(`Created sheet: ${sheetTitle}`);
          await appendMissingColumns(sheetTitle, data.targetHeader);
          actionsPerformed.push(`Wrote header for new sheet: ${sheetTitle}`);
        } else if (data.missingColumns.length > 0) {
          await appendMissingColumns(sheetTitle, data.missingColumns);
          actionsPerformed.push(`Appended ${data.missingColumns.length} columns to ${sheetTitle}: ${data.missingColumns.join(', ')}`);
        }
      }
      if (actionsPerformed.length > 0) {
        const finalSpreadsheet = await getSpreadsheet();
        const finalExisting = finalSpreadsheet.sheets?.map(s => s.properties?.title ?? '') ?? [];
        for (const [sheetTitle, targetHeader] of Object.entries(TARGET_SCHEMA)) {
          const exists = finalExisting.includes(sheetTitle);
          let currentHeader = [];
          if (exists) {
            currentHeader = await getHeader(sheetTitle);
          }
          const currentSet = new Set(currentHeader.map(h => String(h).trim()));
          const similarColumns = findSimilarColumns(currentHeader, targetHeader);
          const similarValues = new Set(Object.values(similarColumns).map(v => String(v).trim()));
          const missingColumns = targetHeader.filter(h => !currentSet.has(String(h).trim()) && !similarColumns[h]);
          const extraColumns = currentHeader.filter(h => !new Set(targetHeader).has(h) && !similarValues.has(h));
          report[sheetTitle] = { ...report[sheetTitle], currentHeader, missingColumns, extraColumns, similarColumns, exists };
        }
      }
    }

    if (isDev) {
      const reportDir = path.join(process.cwd(), 'docs', 'rbac');
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.json'), JSON.stringify({ report, actionsPerformed }, null, 2));
      let csvContent = 'aba;exists;missing;extra;similar;actions\n';
      for (const [sheet, data] of Object.entries(report)) {
        const missing = data.missingColumns.join(', ');
        const extra = data.extraColumns.join(', ');
        const similar = Object.entries(data.similarColumns).map(([k, v]) => `${k}<->${v}`).join(', ');
        const actions = actionsPerformed.filter(a => a.includes(sheet)).join(', ');
        csvContent += `${sheet};${data.exists};"${missing}";"${extra}";"${similar}";"${actions}"\n`;
      }
      await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.csv'), csvContent);
      let mdContent = '# Relatório de Diferenças da Planilha\n\n';
      if (actionsPerformed.length > 0) {
        mdContent += '## Ações Realizadas\n\n';
        actionsPerformed.forEach(a => { mdContent += `- ${a}\n`; });
        mdContent += '\n';
      }
      mdContent += '# Status da Planilha\n\n';
      for (const [sheet, data] of Object.entries(report)) {
        mdContent += `## Aba: **${sheet}**\n\n`;
        mdContent += `- **Existe:** ${data.exists ? 'Sim' : 'Não'}\n`;
        mdContent += `- **Colunas Faltando (${data.missingColumns.length}):** ${data.missingColumns.length > 0 ? `\`${data.missingColumns.join('`, `')}\`` : 'Nenhuma'}\n`;
        mdContent += `- **Colunas Extras (${data.extraColumns.length}):** ${data.extraColumns.length > 0 ? `\`${data.extraColumns.join('`, `')}\`` : 'Nenhuma'}\n`;
        if (Object.keys(data.similarColumns).length > 0) {
          mdContent += '- **Colunas Similares (sugestão):**\n';
          for (const [k, v] of Object.entries(data.similarColumns)) {
            mdContent += `  - \`${k}\` (no schema) pode ser \`${v}\` (na planilha)\n`;
          }
        }
        mdContent += '\n';
      }
      await fs.writeFile(path.join(reportDir, 'rbac_planilha_diff.md'), mdContent);
    }

    return NextResponse.json({
      message: fix ? (isDev ? 'Fix complete. Reports generated in docs/rbac/' : 'Fix complete.') : (isDev ? 'Audit complete. Reports generated in docs/rbac/' : 'Audit complete.'),
      actionsPerformed,
      report,
    });
  } catch (error) {
    console.error('Error during spreadsheet audit:', error);
    return NextResponse.json({ error: 'Failed to audit spreadsheet', details: error.message }, { status: 500 });
  }
}
